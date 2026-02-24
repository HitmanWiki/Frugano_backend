const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

// @desc    Get inventory status
// @route   GET /api/inventory/status
// @access  Private
const getInventoryStatus = async (req, res) => {
  try {
    // Get low stock products
    const lowStock = await prisma.product.findMany({
      where: {
        currentStock: {
          lte: prisma.product.fields.minStockAlert
        },
        isActive: true
      },
      include: {
        category: true
      },
      orderBy: {
        currentStock: 'asc'
      }
    });

    // Get out of stock products
    const outOfStock = await prisma.product.findMany({
      where: {
        currentStock: 0,
        isActive: true
      },
      include: {
        category: true
      }
    });

    // Get inventory value
    const inventoryValue = await prisma.product.aggregate({
      where: {
        isActive: true
      },
      _sum: {
        currentStock: true,
        purchasePrice: true
      }
    });

    // Calculate total value
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: { gt: 0 }
      },
      select: {
        currentStock: true,
        purchasePrice: true,
        sellingPrice: true
      }
    });

    const totalValue = products.reduce(
      (sum, p) => sum + (p.currentStock * p.purchasePrice),
      0
    );

    const potentialRevenue = products.reduce(
      (sum, p) => sum + (p.currentStock * p.sellingPrice),
      0
    );

    res.json({
      success: true,
      data: {
        lowStock: {
          count: lowStock.length,
          items: lowStock
        },
        outOfStock: {
          count: outOfStock.length,
          items: outOfStock
        },
        valuation: {
          costValue: totalValue,
          retailValue: potentialRevenue,
          potentialProfit: potentialRevenue - totalValue
        }
      }
    });
  } catch (error) {
    console.error('Get inventory status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get inventory transactions
// @route   GET /api/inventory/transactions
// @access  Private
const getTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      productId,
      type,
      startDate,
      endDate
    } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const where = {};

    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take
    });

    const total = await prisma.inventoryTransaction.count({ where });

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get stock alerts
// @route   GET /api/inventory/alerts
// @access  Private
const getStockAlerts = async (req, res) => {
  try {
    const alerts = await prisma.stockAlert.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        product: {
          include: {
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Get stock alerts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Resolve stock alert
// @route   PATCH /api/inventory/alerts/:id/resolve
// @access  Private
const resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await prisma.stockAlert.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: req.user.id
      }
    });

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get inventory movement report
// @route   GET /api/inventory/movement
// @access  Private
const getMovementReport = async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;

    const where = {
      createdAt: {
        gte: startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30)),
        lte: endDate ? new Date(endDate) : new Date()
      }
    };

    if (productId) where.productId = productId;

    const movements = await prisma.inventoryTransaction.groupBy({
      by: ['type', 'productId'],
      where,
      _sum: {
        quantity: true
      },
      _count: true
    });

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: [...new Set(movements.map(m => m.productId))]
        }
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

    const report = movements.map(m => ({
      type: m.type,
      product: productMap[m.productId],
      totalQuantity: m._sum.quantity,
      transactionCount: m._count
    }));

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get movement report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getInventoryStatus,
  getTransactions,
  getStockAlerts,
  resolveAlert,
  getMovementReport
};