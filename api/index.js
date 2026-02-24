const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load env variables
dotenv.config();

// Import routes
const authRoutes = require('../src/routes/auth.routes');
const userRoutes = require('../src/routes/user.routes');
const categoryRoutes = require('../src/routes/category.routes');
const productRoutes = require('../src/routes/product.routes');
const saleRoutes = require('../src/routes/sale.routes');
const purchaseRoutes = require('../src/routes/purchase.routes');
const supplierRoutes = require('../src/routes/supplier.routes');
const inventoryRoutes = require('../src/routes/inventory.routes');
const customerRoutes = require('../src/routes/customer.routes');
const dashboardRoutes = require('../src/routes/dashboard.routes');
const campaignRoutes = require('../src/routes/campaign.routes');
const reportRoutes = require('../src/routes/report.routes');
const hardwareRoutes = require('../src/routes/hardware.routes');

// Import middleware
const { errorHandler } = require('../src/middleware/errorHandler');
const { authenticate } = require('../src/middleware/auth');

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://frugano-frontend.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// DEBUG ENDPOINTS - Add these FIRST
// ============================================
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong', time: new Date().toISOString() });
});

app.get('/api/debug-routes', (req, res) => {
  const routes = [];
  
  // Collect all registered routes
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  
  res.json({
    message: 'Registered Routes',
    count: routes.length,
    routes: routes,
    env: process.env.NODE_ENV
  });
});

app.get('/api/db-test', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const userCount = await prisma.user.count();
    await prisma.$disconnect();
    res.json({ 
      success: true, 
      message: 'Database connected',
      userCount,
      databaseUrl: process.env.DATABASE_URL ? 'Set' : 'NOT SET'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// API ROUTES
// ============================================
console.log('📦 Mounting API routes...');

app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/categories', authenticate, categoryRoutes);
app.use('/api/products', authenticate, productRoutes);
app.use('/api/sales', authenticate, saleRoutes);
app.use('/api/purchases', authenticate, purchaseRoutes);
app.use('/api/suppliers', authenticate, supplierRoutes);
app.use('/api/inventory', authenticate, inventoryRoutes);
app.use('/api/customers', authenticate, customerRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/campaigns', authenticate, campaignRoutes);
app.use('/api/reports', authenticate, reportRoutes);
app.use('/api/hardware', authenticate, hardwareRoutes);

console.log('✅ API routes mounted');

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Frugano API',
    version: '1.0.0',
    status: 'running'
  });
});

// 404 handler - MUST BE LAST
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Export for serverless
module.exports = app;