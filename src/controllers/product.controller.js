const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

// @desc    Get all products
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      isActive,
      lowStock,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    // Build filter
    const where = {};
    
    if (category) {
      where.categoryId = category;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (lowStock === 'true') {
      where.currentStock = {
        lte: prisma.product.fields.minStockAlert
      };
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get products
    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        stockAlerts: {
          where: { status: 'ACTIVE' },
          select: { id: true }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip,
      take
    });

    // Get total count
    const total = await prisma.product.count({ where });

    // Get summary stats
    const summary = await prisma.product.aggregate({
      where,
      _sum: {
        currentStock: true,
        purchasePrice: true,
        sellingPrice: true
      },
      _avg: {
        sellingPrice: true
      }
    });

    res.json({
      success: true,
      data: products,
      summary: {
        totalProducts: total,
        totalStock: summary._sum.currentStock || 0,
        inventoryValue: (summary._sum.currentStock || 0) * (summary._sum.purchasePrice || 0),
        avgPrice: summary._avg.sellingPrice || 0
      },
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        stockAlerts: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' }
        },
        inventoryItems: {
          take: 20,
          orderBy: { createdAt: 'desc' },
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

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Calculate statistics
    const stats = await prisma.$transaction([
      prisma.saleItem.aggregate({
        where: { productId: id },
        _sum: { quantity: true, total: true },
        _count: true
      }),
      prisma.purchaseItem.aggregate({
        where: { productId: id },
        _sum: { quantity: true, total: true }
      }),
      prisma.wastage.aggregate({
        where: { productId: id },
        _sum: { quantity: true, totalLoss: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        ...product,
        statistics: {
          totalSold: stats[0]._sum.quantity || 0,
          totalRevenue: stats[0]._sum.total || 0,
          totalPurchased: stats[1]._sum.quantity || 0,
          totalWastage: stats[2]._sum.quantity || 0,
          totalLoss: stats[2]._sum.totalLoss || 0,
          salesCount: stats[0]._count
        }
      }
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private (Owner, Manager, Inventory)
// @desc    Create product
// @route   POST /api/products
// @access  Private (Owner, Manager, Inventory)
const createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }

    const {
      name,
      description,
      sku,
      barcode,
      categoryId,
      purchasePrice,
      sellingPrice,
      mrp,
      unit,
      taxRate,
      minStockAlert,
      currentStock,
      image,
      images,
      isOrganic,
      isSeasonal,
      season,
      expiryDays,
      nutritionalInfo
    } = req.body;

    // Validate category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Check if SKU already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sku }
    });

    if (existingProduct) {
      return res.status(400).json({ error: 'Product with this SKU already exists' });
    }

    // Check if barcode already exists (if provided)
    if (barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode }
      });
      if (existingBarcode) {
        return res.status(400).json({ error: 'Product with this barcode already exists' });
      }
    }

    // Create product with transaction
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name,
          description,
          sku,
          barcode,
          categoryId,
          purchasePrice: parseFloat(purchasePrice),
          sellingPrice: parseFloat(sellingPrice),
          mrp: mrp ? parseFloat(mrp) : null,
          unit,
          taxRate: parseFloat(taxRate || 0),
          minStockAlert: parseFloat(minStockAlert || 10),
          currentStock: parseFloat(currentStock || 0),
          image,
          images: images || [],
          isOrganic: isOrganic || false,
          isSeasonal: isSeasonal || false,
          season,
          expiryDays: expiryDays ? parseInt(expiryDays) : null,
          nutritionalInfo: nutritionalInfo || null
        }
      });

      // Create initial inventory transaction if stock > 0
      if (currentStock > 0) {
        await tx.inventoryTransaction.create({
          data: {
            productId: newProduct.id,
            type: 'PURCHASE',
            quantity: parseFloat(currentStock),
            beforeStock: 0,
            afterStock: parseFloat(currentStock),
            notes: 'Initial stock',
            createdById: req.user.id
          }
        });
      }

      return newProduct;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_PRODUCT',
        entity: 'Product',
        entityId: product.id,
        details: { name, sku }
      }
    });

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Owner, Manager, Inventory)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_PRODUCT',
        entity: 'Product',
        entityId: product.id,
        details: { name: product.name }
      }
    });

    // Emit socket event if available
    try {
      const io = req.app.get('io');
      if (io) io.emit('product-updated', { id: product.id, name: product.name });
    } catch (e) {
      // Socket not available, ignore
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'SKU or barcode already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Update stock
// @route   PATCH /api/products/:id/stock
// @access  Private (Inventory)
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type, notes, reason } = req.body;

    // Validate input
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity required' });
    }

    if (!type || !['ADD', 'REMOVE', 'SET', 'WASTE'].includes(type)) {
      return res.status(400).json({ error: 'Invalid stock operation type' });
    }

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const beforeStock = product.currentStock;
    let afterStock = beforeStock;
    let transactionType = 'ADJUSTMENT';

    // Calculate new stock
    switch (type) {
      case 'ADD':
        afterStock = beforeStock + parseFloat(quantity);
        transactionType = 'PURCHASE';
        break;
      case 'REMOVE':
        afterStock = beforeStock - parseFloat(quantity);
        if (afterStock < 0) {
          return res.status(400).json({ 
            error: 'Insufficient stock',
            available: beforeStock,
            requested: quantity
          });
        }
        transactionType = 'SALE';
        break;
      case 'SET':
        afterStock = parseFloat(quantity);
        break;
      case 'WASTE':
        afterStock = beforeStock - parseFloat(quantity);
        if (afterStock < 0) {
          return res.status(400).json({ error: 'Insufficient stock' });
        }
        transactionType = 'WASTAGE';
        break;
    }

    // Update stock with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update product stock
      const updatedProduct = await tx.product.update({
        where: { id },
        data: { currentStock: afterStock }
      });

      // Create inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          productId: id,
          type: transactionType,
          quantity: type === 'ADD' ? parseFloat(quantity) : -parseFloat(quantity),
          beforeStock,
          afterStock,
          reference: req.body.reference,
          notes: notes || reason,
          createdById: req.user.id
        }
      });

      // Check if stock is below minimum and create alert
      if (afterStock < product.minStockAlert && afterStock > 0) {
        const existingAlert = await tx.stockAlert.findFirst({
          where: {
            productId: id,
            status: 'ACTIVE'
          }
        });

        if (!existingAlert) {
          await tx.stockAlert.create({
            data: {
              productId: id,
              currentStock: afterStock,
              minStockLevel: product.minStockAlert,
              status: 'ACTIVE'
            }
          });
        }
      }

      // If stock is 0, create urgent alert
      if (afterStock === 0) {
        await tx.stockAlert.create({
          data: {
            productId: id,
            currentStock: 0,
            minStockLevel: product.minStockAlert,
            status: 'ACTIVE'
          }
        });
      }

      // Resolve alerts if stock is above minimum
      if (afterStock >= product.minStockAlert) {
        await tx.stockAlert.updateMany({
          where: {
            productId: id,
            status: 'ACTIVE'
          },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedById: req.user.id
          }
        });
      }

      return updatedProduct;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_STOCK',
        entity: 'Product',
        entityId: id,
        details: { 
          type, 
          quantity, 
          beforeStock, 
          afterStock,
          notes 
        }
      }
    });

    // Emit socket event if available
    try {
      const io = req.app.get('io');
      if (io) io.emit('stock-updated', { 
        productId: id, 
        beforeStock, 
        afterStock,
        type 
      });
    } catch (e) {
      // Socket not available, ignore
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Bulk create products
// @route   POST /api/products/bulk
// @access  Private (Owner, Manager)
const bulkCreateProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products array is required' });
    }

    const results = {
      success: [],
      failed: []
    };

    await prisma.$transaction(async (tx) => {
      for (const product of products) {
        try {
          const newProduct = await tx.product.create({
            data: {
              name: product.name,
              sku: product.sku,
              barcode: product.barcode,
              categoryId: product.categoryId,
              purchasePrice: parseFloat(product.purchasePrice),
              sellingPrice: parseFloat(product.sellingPrice),
              unit: product.unit,
              currentStock: parseFloat(product.currentStock || 0),
              minStockAlert: parseFloat(product.minStockAlert || 10)
            }
          });
          results.success.push(newProduct);
        } catch (error) {
          results.failed.push({
            product: product.name,
            error: error.message
          });
        }
      }
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Bulk create error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Owner only)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product has sales or purchases
    const salesCount = await prisma.saleItem.count({
      where: { productId: id }
    });

    const purchasesCount = await prisma.purchaseItem.count({
      where: { productId: id }
    });

    if (salesCount > 0 || purchasesCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product with transaction history',
        sales: salesCount,
        purchases: purchasesCount,
        suggestion: 'Archive the product instead by setting isActive to false'
      });
    }

    await prisma.product.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_PRODUCT',
        entity: 'Product',
        entityId: id
      }
    });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  updateStock,
  bulkCreateProducts,
  deleteProduct
};