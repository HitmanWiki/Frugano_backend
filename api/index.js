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
const upiRoutes = require('../src/routes/upi.routes'); // ✅ NEW: UPI Routes

// Import middleware
const { errorHandler } = require('../src/middleware/errorHandler');
const { authenticate } = require('../src/middleware/auth');

const app = express();

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://frugano-frontend.vercel.app',
  'https://frugano-admin.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// HEALTH CHECK ENDPOINTS (Public)
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime()
  });
});

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

// ============================================
// API ROUTES
// ============================================
console.log('📦 Mounting API routes...');

// Public routes (no authentication required)
app.use('/api/auth', authRoutes);

// Protected routes (authentication required)
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
app.use('/api/upi',  upiRoutes); // ✅ NEW: UPI Routes (protected)

console.log('✅ API routes mounted');

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Frugano API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    endpoints: {
      public: {
        health: '/health',
        test: '/api/test',
        ping: '/api/ping'
      },
      auth: {
        login: '/api/auth/login (POST)',
        setup: '/api/auth/setup (POST)',
        me: '/api/auth/me (GET)'
      },
      upi: {
        generateAmount: '/api/upi/generate-amount (POST)',
        generateSale: '/api/upi/generate/:saleId (POST)',
        download: '/api/upi/download/:orderId (GET)',
        verify: '/api/upi/verify (POST)'
      }
      // ... other endpoints
    }
  });
});

// 404 handler - MUST BE LAST
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method,
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use(errorHandler);

// Export for serverless
module.exports = app;