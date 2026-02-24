const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

// @desc    Create new sale (POS)
// @route   POST /api/sales
// @access  Private (Cashier, Manager)
const createSale = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      customerName,
      customerPhone,
      customerId,
      items,
      discount = 0,
      paymentMethod,
      paymentReference,
      notes
    } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Generate invoice number
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const count = await prisma.sale.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999))
        }
      }
    });
    
    const invoiceNo = `INV-${year}${month}${day}-${(count + 1).toString().padStart(4, '0')}`;

    // Process items and calculate totals
    let subtotal = 0;
    let totalTax = 0;
    const processedItems = [];

    for (const item of items) {
      // Validate product exists
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.productId}` });
      }

      // Validate stock
      if (product.currentStock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}`,
          product: product.name,
          available: product.currentStock,
          requested: item.quantity
        });
      }

      const price = item.price || product.sellingPrice;
      const itemTotal = price * item.quantity;
      const itemTax = (itemTotal * (item.taxRate || product.taxRate)) / 100;
      
      subtotal += itemTotal;
      totalTax += itemTax;

      processedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        sellingPrice: price,
        discount: item.discount || 0,
        taxAmount: itemTax,
        total: itemTotal + itemTax,
        weightMeasured: item.weightMeasured || false,
        weightId: item.weightId
      });
    }

    const totalAmount = subtotal - discount + totalTax;

    // Create sale
    const newSale = await prisma.sale.create({
      data: {
        invoiceNo,
        customerName,
        customerPhone,
        customerId,
        subtotal,
        discount,
        taxAmount: totalTax,
        totalAmount,
        paymentMethod,
        notes,
        cashierId: req.user.id,
        items: {
          create: processedItems
        },
        payments: {
          create: {
            amount: totalAmount,
            paymentMethod,
            referenceNo: paymentReference
          }
        }
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unit: true
              }
            }
          }
        }
      }
    });

    // Update stock and create inventory transactions
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      await prisma.product.update({
        where: { id: item.productId },
        data: {
          currentStock: {
            decrement: item.quantity
          }
        }
      });

      await prisma.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: 'SALE',
          quantity: -item.quantity,
          beforeStock: product.currentStock,
          afterStock: product.currentStock - item.quantity,
          reference: newSale.id,
          notes: `Sale #${invoiceNo}`,
          createdById: req.user.id
        }
      });

      // Check if stock is below minimum
      if (product.currentStock - item.quantity < product.minStockAlert) {
        const existingAlert = await prisma.stockAlert.findFirst({
          where: {
            productId: item.productId,
            status: 'ACTIVE'
          }
        });

        if (!existingAlert) {
          await prisma.stockAlert.create({
            data: {
              productId: item.productId,
              currentStock: product.currentStock - item.quantity,
              minStockLevel: product.minStockAlert,
              status: 'ACTIVE'
            }
          });
        }
      }
    }

    // Update customer total spent if customer exists
    if (customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: totalAmount },
          loyaltyPoints: { increment: Math.floor(totalAmount / 100) }
        }
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_SALE',
        entity: 'Sale',
        entityId: newSale.id,
        details: { 
          invoiceNo, 
          amount: totalAmount,
          items: items.length
        }
      }
    });

    res.status(201).json({
      success: true,
      data: newSale
    });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
const getSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      paymentMethod,
      cashierId,
      customerId,
      search
    } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Build filter
    const where = {};
    
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate);
    }
    
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }
    
    if (cashierId) {
      where.cashierId = cashierId;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } }
      ];
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        cashier: {
          select: {
            id: true,
            name: true
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unit: true
              }
            }
          }
        },
        payments: true
      },
      orderBy: {
        saleDate: 'desc'
      },
      skip,
      take
    });

    const total = await prisma.sale.count({ where });

    // Calculate summary
    const summary = await prisma.sale.aggregate({
      where,
      _sum: {
        subtotal: true,
        discount: true,
        taxAmount: true,
        totalAmount: true
      },
      _count: true
    });

    // Get payment method breakdown
    const paymentBreakdown = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      where,
      _sum: {
        totalAmount: true
      },
      _count: true
    });

    res.json({
      success: true,
      data: sales,
      summary: {
        totalSales: summary._count,
        totalRevenue: summary._sum.totalAmount || 0,
        totalDiscount: summary._sum.discount || 0,
        totalTax: summary._sum.taxAmount || 0,
        averageTicket: (summary._sum.totalAmount || 0) / (summary._count || 1)
      },
      paymentBreakdown,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private
const getSale = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get sale by invoice number
// @route   GET /api/sales/invoice/:invoiceNo
// @access  Private
const getSaleByInvoice = async (req, res) => {
  try {
    const { invoiceNo } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { invoiceNo },
      include: {
        cashier: {
          select: {
            id: true,
            name: true
          }
        },
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Get sale by invoice error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Void/cancel sale
// @route   POST /api/sales/:id/void
// @access  Private (Manager, Owner)
const voidSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (sale.paymentStatus === 'CANCELLED') {
      return res.status(400).json({ error: 'Sale already cancelled' });
    }

    // Void sale with transaction
    await prisma.$transaction(async (tx) => {
      // Update sale status
      await tx.sale.update({
        where: { id },
        data: {
          paymentStatus: 'CANCELLED',
          notes: `CANCELLED: ${reason || 'No reason provided'}`
        }
      });

      // Restore stock
      for (const item of sale.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              increment: item.quantity
            }
          }
        });

        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId,
            type: 'RETURN',
            quantity: item.quantity,
            beforeStock: product.currentStock,
            afterStock: product.currentStock + item.quantity,
            reference: sale.id,
            notes: `Sale voided: ${reason}`,
            createdById: req.user.id
          }
        });
      }

      // Update customer stats if exists
      if (sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            totalOrders: { decrement: 1 },
            totalSpent: { decrement: sale.totalAmount }
          }
        });
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: req.user.id,
          action: 'VOID_SALE',
          entity: 'Sale',
          entityId: sale.id,
          details: { 
            invoiceNo: sale.invoiceNo, 
            reason,
            amount: sale.totalAmount
          }
        }
      });
    });

    // Emit socket event
    const io = req.app.get('io');
    io.emit('sale-voided', { 
      invoiceNo: sale.invoiceNo,
      reason 
    });

    res.json({
      success: true,
      message: 'Sale voided successfully'
    });
  } catch (error) {
    console.error('Void sale error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get daily sales summary
// @route   GET /api/sales/summary/daily
// @access  Private
const getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

    const sales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        paymentStatus: { not: 'CANCELLED' }
      },
      include: {
        payments: true,
        cashier: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        saleDate: 'asc'
      }
    });

    // Calculate summary
    const summary = {
      date: startOfDay,
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      totalDiscount: sales.reduce((sum, sale) => sum + sale.discount, 0),
      totalTax: sales.reduce((sum, sale) => sum + sale.taxAmount, 0),
      byPaymentMethod: {},
      byCashier: {},
      hourlyBreakdown: Array(24).fill(0).map(() => ({ count: 0, amount: 0 }))
    };

    // Calculate breakdowns
    sales.forEach(sale => {
      // Payment method breakdown
      if (!summary.byPaymentMethod[sale.paymentMethod]) {
        summary.byPaymentMethod[sale.paymentMethod] = {
          count: 0,
          amount: 0
        };
      }
      summary.byPaymentMethod[sale.paymentMethod].count++;
      summary.byPaymentMethod[sale.paymentMethod].amount += sale.totalAmount;

      // Cashier breakdown
      const cashierName = sale.cashier?.name || 'Unknown';
      if (!summary.byCashier[cashierName]) {
        summary.byCashier[cashierName] = {
          count: 0,
          amount: 0
        };
      }
      summary.byCashier[cashierName].count++;
      summary.byCashier[cashierName].amount += sale.totalAmount;

      // Hourly breakdown
      const hour = new Date(sale.saleDate).getHours();
      summary.hourlyBreakdown[hour].count++;
      summary.hourlyBreakdown[hour].amount += sale.totalAmount;
    });

    // Get previous day comparison
    const prevDayStart = new Date(startOfDay);
    prevDayStart.setDate(prevDayStart.getDate() - 1);
    const prevDayEnd = new Date(endOfDay);
    prevDayEnd.setDate(prevDayEnd.getDate() - 1);

    const prevDaySales = await prisma.sale.aggregate({
      where: {
        saleDate: {
          gte: prevDayStart,
          lte: prevDayEnd
        },
        paymentStatus: { not: 'CANCELLED' }
      },
      _sum: {
        totalAmount: true
      },
      _count: true
    });

    summary.comparison = {
      previousDayRevenue: prevDaySales._sum.totalAmount || 0,
      previousDayCount: prevDaySales._count || 0,
      revenueChange: summary.totalRevenue - (prevDaySales._sum.totalAmount || 0),
      countChange: summary.totalSales - (prevDaySales._count || 0)
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get daily summary error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get sales analytics
// @route   GET /api/sales/analytics
// @access  Private (Manager, Owner)
const getSalesAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate;
    const endDate = new Date();
    
    switch (period) {
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const sales = await prisma.sale.groupBy({
      by: ['saleDate'],
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate
        },
        paymentStatus: { not: 'CANCELLED' }
      },
      _sum: {
        totalAmount: true
      },
      _count: true,
      orderBy: {
        saleDate: 'asc'
      }
    });

    // Get top products
    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          saleDate: {
            gte: startDate,
            lte: endDate
          },
          paymentStatus: { not: 'CANCELLED' }
        }
      },
      _sum: {
        quantity: true,
        total: true
      },
      _count: true,
      orderBy: {
        _sum: {
          total: 'desc'
        }
      },
      take: 10
    });

    // Get product details for top products
    const productIds = topProducts.map(p => p.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      },
      select: {
        id: true,
        name: true,
        sku: true
      }
    });

    const productMap = products.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const formattedTopProducts = topProducts.map(p => ({
      ...p,
      product: productMap[p.productId]
    }));

    res.json({
      success: true,
      data: {
        period,
        sales,
        topProducts: formattedTopProducts
      }
    });
  } catch (error) {
    console.error('Get sales analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createSale,
  getSales,
  getSale,
  getSaleByInvoice,
  voidSale,
  getDailySummary,
  getSalesAnalytics
};