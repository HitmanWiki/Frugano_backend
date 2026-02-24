const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');



// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;

    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: {
            orders: true,
            feedback: true
          }
        }
      },
      orderBy: { name: 'asc' },
      skip,
      take
    });

    const total = await prisma.customer.count({ where });

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        feedback: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        walletTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
// @desc    Create customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, address } = req.body;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { phone }
    });

    if (existingCustomer) {
      return res.status(400).json({ error: 'Customer with this phone already exists' });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        email,
        addresses: address ? {
          create: {
            addressLine1: address,
            city: 'Unknown',
            state: 'Unknown',
            pincode: '000000',
            isDefault: true
          }
        } : undefined
      }
    });

    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Create customer error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Customer with this phone/email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};
// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (Manager, Owner)
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.customer.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get customer transactions
// @route   GET /api/customers/:id/transactions
// @access  Private
const getCustomerTransactions = async (req, res) => {
  try {
    const { id } = req.params;

    const transactions = await prisma.$transaction([
      prisma.sale.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.walletTransaction.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ]);

    res.json({
      success: true,
      data: {
        sales: transactions[0],
        wallet: transactions[1]
      }
    });
  } catch (error) {
    console.error('Get customer transactions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerTransactions
};