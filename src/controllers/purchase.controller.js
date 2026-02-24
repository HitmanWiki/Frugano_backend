const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

// @desc    Get all purchases
// @route   GET /api/purchases
// @access  Private
const getPurchases = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      supplierId,
      startDate,
      endDate,
      paymentStatus,
      search
    } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const where = {};

    if (supplierId) where.supplierId = supplierId;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    
    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = new Date(startDate);
      if (endDate) where.purchaseDate.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true
              }
            }
          }
        },
        payments: true
      },
      orderBy: {
        purchaseDate: 'desc'
      },
      skip,
      take
    });

    const total = await prisma.purchase.count({ where });

    // Calculate summary
    const summary = await prisma.purchase.aggregate({
      where,
      _sum: {
        totalAmount: true,
        discount: true,
        taxAmount: true,
        netAmount: true
      },
      _count: true
    });

    res.json({
      success: true,
      data: purchases,
      summary: {
        totalPurchases: summary._count,
        totalAmount: summary._sum.totalAmount || 0,
        totalDiscount: summary._sum.discount || 0,
        totalTax: summary._sum.taxAmount || 0,
        netAmount: summary._sum.netAmount || 0
      },
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get single purchase
// @route   GET /api/purchases/:id
// @access  Private
const getPurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          include: {
            product: true
          }
        },
        payments: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    res.json({
      success: true,
      data: purchase
    });
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Create purchase
// @route   POST /api/purchases
// @access  Private (Owner, Manager, Inventory)
const createPurchase = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      supplierId,
      invoiceNo,
      purchaseDate,
      items,
      discount = 0,
      taxAmount = 0,
      paymentStatus = 'PENDING',
      paymentMethod,
      notes
    } = req.body;

    // Validate supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      return res.status(400).json({ error: 'Supplier not found' });
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Generate invoice number if not provided
    const finalInvoiceNo = invoiceNo || `PO-${Date.now()}`;

    // Calculate totals
    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      // Validate product exists
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.productId}` });
      }

      // Validate quantity and price
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: `Invalid quantity for product ${product.name}` });
      }

      if (!item.purchasePrice || item.purchasePrice <= 0) {
        return res.status(400).json({ error: `Invalid purchase price for product ${product.name}` });
      }

      const itemTotal = item.purchasePrice * item.quantity;
      totalAmount += itemTotal;

      processedItems.push({
        productId: item.productId,
        quantity: parseFloat(item.quantity),
        purchasePrice: parseFloat(item.purchasePrice),
        sellingPrice: item.sellingPrice ? parseFloat(item.sellingPrice) : product.sellingPrice,
        total: itemTotal,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
      });
    }

    const netAmount = totalAmount - parseFloat(discount) + parseFloat(taxAmount);

    // Create purchase
    const newPurchase = await prisma.purchase.create({
      data: {
        invoiceNo: finalInvoiceNo,
        supplierId,
        purchaseDate: new Date(purchaseDate || Date.now()),
        totalAmount,
        discount: parseFloat(discount),
        taxAmount: parseFloat(taxAmount),
        netAmount,
        paymentStatus,
        paymentMethod,
        notes,
        createdById: req.user.id,
        items: {
          create: processedItems
        }
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Update stock and create inventory transactions
    for (const item of processedItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      await prisma.product.update({
        where: { id: item.productId },
        data: {
          currentStock: {
            increment: item.quantity
          }
        }
      });

      await prisma.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: 'PURCHASE',
          quantity: item.quantity,
          beforeStock: product.currentStock,
          afterStock: product.currentStock + item.quantity,
          reference: newPurchase.id,
          notes: `Purchase #${finalInvoiceNo}`,
          createdById: req.user.id
        }
      });
    }

    // Update supplier balance
    if (paymentStatus === 'PENDING' || paymentStatus === 'PARTIAL') {
      await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          currentBalance: {
            increment: netAmount
          }
        }
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_PURCHASE',
        entity: 'Purchase',
        entityId: newPurchase.id,
        details: { 
          invoiceNo: newPurchase.invoiceNo, 
          amount: newPurchase.netAmount 
        }
      }
    });

    res.status(201).json({
      success: true,
      data: newPurchase
    });
  } catch (error) {
    console.error('Create purchase error:', error);
    // Send more detailed error message for debugging
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Update purchase
// @route   PUT /api/purchases/:id
// @access  Private (Owner, Manager)
const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const purchase = await prisma.purchase.update({
      where: { id },
      data: updateData
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_PURCHASE',
        entity: 'Purchase',
        entityId: purchase.id,
        details: { invoiceNo: purchase.invoiceNo }
      }
    });

    res.json({
      success: true,
      data: purchase
    });
  } catch (error) {
    console.error('Update purchase error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Delete purchase
// @route   DELETE /api/purchases/:id
// @access  Private (Owner only)
const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.purchase.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_PURCHASE',
        entity: 'Purchase',
        entityId: id
      }
    });

    res.json({
      success: true,
      message: 'Purchase deleted successfully'
    });
  } catch (error) {
    console.error('Delete purchase error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Add payment to purchase
// @route   POST /api/purchases/:id/payments
// @access  Private (Owner, Manager)
const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, referenceNo, notes } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method required' });
    }

    // Find the purchase
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        payments: true
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    // Calculate total paid so far
    const totalPaid = purchase.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const newTotalPaid = totalPaid + parseFloat(amount);

    // Check if payment exceeds balance
    if (newTotalPaid > purchase.netAmount) {
      return res.status(400).json({ 
        error: 'Payment amount exceeds remaining balance',
        remainingBalance: purchase.netAmount - totalPaid
      });
    }

    // Create payment and update status in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the payment
      const newPayment = await tx.supplierPayment.create({
        data: {
          supplierId: purchase.supplierId,
          purchaseId: id,
          amount: parseFloat(amount),
          paymentMethod,
          referenceNo,
          notes,
          createdById: req.user.id
        }
      });

      // Determine new payment status
      let paymentStatus = 'PARTIAL';
      if (newTotalPaid >= purchase.netAmount) {
        paymentStatus = 'PAID';
      }

      // Update purchase payment status
      await tx.purchase.update({
        where: { id },
        data: { paymentStatus }
      });

      // Update supplier balance (decrease the amount owed)
      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: {
          currentBalance: {
            decrement: parseFloat(amount)
          }
        }
      });

      return newPayment;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'ADD_PAYMENT',
        entity: 'Purchase',
        entityId: purchase.id,
        details: { 
          amount: parseFloat(amount),
          paymentMethod,
          invoiceNo: purchase.invoiceNo
        }
      }
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Payment added successfully'
    });
  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

module.exports = {
  getPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  addPayment
};