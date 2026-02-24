const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private
const getSuppliers = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, search } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const where = {};
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { gstNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            purchases: true,
            payments: true
          }
        }
      },
      orderBy: { name: 'asc' },
      skip,
      take
    });

    const total = await prisma.supplier.count({ where });

    // Get summary stats
    const summary = await prisma.supplier.aggregate({
      where,
      _sum: {
        currentBalance: true,
        openingBalance: true
      }
    });

    res.json({
      success: true,
      data: suppliers,
      summary: {
        totalSuppliers: total,
        totalBalance: summary._sum.currentBalance || 0,
        totalOpeningBalance: summary._sum.openingBalance || 0
      },
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// @access  Private
const getSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          take: 20,
          orderBy: { purchaseDate: 'desc' },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true
                  }
                }
              }
            }
          }
        },
        payments: {
          take: 20,
          orderBy: { paymentDate: 'desc' },
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

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Calculate statistics
    const stats = await prisma.$transaction([
      prisma.purchase.aggregate({
        where: { supplierId: id },
        _sum: { netAmount: true },
        _count: true
      }),
      prisma.supplierPayment.aggregate({
        where: { supplierId: id },
        _sum: { amount: true },
        _count: true
      })
    ]);

    res.json({
      success: true,
      data: {
        ...supplier,
        statistics: {
          totalPurchases: stats[0]._count,
          totalPurchaseAmount: stats[0]._sum.netAmount || 0,
          totalPayments: stats[1]._count,
          totalPaidAmount: stats[1]._sum.amount || 0,
          currentBalance: supplier.currentBalance
        }
      }
    });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Create supplier
// @route   POST /api/suppliers
// @access  Private (Owner, Manager, Inventory)
const createSupplier = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      phone,
      email,
      address,
      gstNumber,
      paymentTerms,
      openingBalance = 0
    } = req.body;

    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone,
        email,
        address,
        gstNumber,
        paymentTerms,
        openingBalance: parseFloat(openingBalance),
        currentBalance: parseFloat(openingBalance)
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_SUPPLIER',
        entity: 'Supplier',
        entityId: supplier.id,
        details: { name }
      }
    });

    res.status(201).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Create supplier error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Supplier with this GST number already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private (Owner, Manager, Inventory)
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: updateData
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_SUPPLIER',
        entity: 'Supplier',
        entityId: supplier.id,
        details: { name: supplier.name }
      }
    });

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Update supplier error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Delete supplier
// @route   DELETE /api/suppliers/:id
// @access  Private (Owner only)
const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier has purchases
    const purchaseCount = await prisma.purchase.count({
      where: { supplierId: id }
    });

    if (purchaseCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete supplier with purchase history. Deactivate instead.',
        purchaseCount
      });
    }

    await prisma.supplier.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_SUPPLIER',
        entity: 'Supplier',
        entityId: id
      }
    });

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Delete supplier error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier
};