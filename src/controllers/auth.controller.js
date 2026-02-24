const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    console.log('Login attempt:', req.body.email);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('User found:', user.email, 'Role:', user.role);

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for user:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if active
    if (!user.isActive) {
      console.log('User inactive:', email);
      return res.status(401).json({ error: 'Account is deactivated. Contact administrator.' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Create token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    console.log('Login successful for:', email);

    // Log activity (try-catch to prevent login failure if logging fails)
    try {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'User',
          entityId: user.id,
          details: { 
            email: user.email, 
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
          }
        }
      });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
      // Continue - don't fail login because logging failed
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error details:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    console.log('Get profile for user:', req.user.id);
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        lastLogin: true,
        createdAt: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user statistics
    const [salesCount, salesTotal] = await Promise.all([
      prisma.sale.count({ where: { cashierId: req.user.id } }),
      prisma.sale.aggregate({
        where: { cashierId: req.user.id },
        _sum: { totalAmount: true }
      })
    ]);

    res.json({
      success: true,
      user: {
        ...user,
        stats: {
          totalSales: salesCount,
          totalAmount: salesTotal._sum.totalAmount || 0
        }
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // Log activity (try-catch to prevent logout failure if logging fails)
    try {
      await prisma.activityLog.create({
        data: {
          userId: req.user.id,
          action: 'LOGOUT',
          entity: 'User',
          entityId: req.user.id,
          details: { 
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
          }
        }
      });
    } catch (logError) {
      console.error('Failed to log logout:', logError);
    }

    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          userId: req.user.id,
          action: 'CHANGE_PASSWORD',
          entity: 'User',
          entityId: req.user.id,
          details: { ip: req.ip || req.connection.remoteAddress }
        }
      });
    } catch (logError) {
      console.error('Failed to log password change:', logError);
    }

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Setup initial owner
// @route   POST /api/auth/setup
// @access  Public
const setupOwner = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name are required' });
    }

    // Check if any user exists
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      return res.status(400).json({ error: 'Setup already completed' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: 'OWNER',
        isActive: true
      }
    });

    // Create default categories
    await prisma.category.createMany({
      data: [
        { name: 'Fruits', description: 'Fresh fruits' },
        { name: 'Vegetables', description: 'Fresh vegetables' },
        { name: 'Exotic', description: 'Exotic fruits & vegetables' },
        { name: 'Organic', description: 'Certified organic produce' }
      ],
      skipDuplicates: true
    });

    console.log('Owner created successfully:', email);

    res.json({ 
      success: true, 
      message: 'Owner created successfully',
      user: {
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Server error during setup' });
  }
};

module.exports = {
  login,
  getMe,
  logout,
  changePassword,
  setupOwner
};