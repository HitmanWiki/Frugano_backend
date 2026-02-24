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
const upiRoutes = require('../src/routes/upi.routes');
const settingsRoutes = require('../src/routes/settings.routes');
const printRoutes = require('../src/routes/print.routes');

// Import middleware
const { errorHandler } = require('../src/middleware/errorHandler');
const { authenticate } = require('../src/middleware/auth');

// Detect if running on Vercel
const isVercel = process.env.VERCEL === '1';
console.log(`🚀 Running on ${isVercel ? 'Vercel' : 'Local'} environment`);

const app = express();

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://frugano-frontend.vercel.app',
  'https://frugano-admin.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

console.log('🔓 CORS Allowed Origins:', allowedOrigins);

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
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
}));

// Handle preflight requests
app.options('*', cors());

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", ...allowedOrigins]
    }
  }
}));

// Logging
app.use(morgan('combined'));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// HEALTH CHECK ENDPOINTS (Public)
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production',
    vercel: isVercel
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

// UPI routes - Public for QR generation (no auth needed for POS)
app.use('/api/upi', upiRoutes);

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
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/print', authenticate, printRoutes);

console.log('✅ API routes mounted');

// ============================================
// ROOT ENDPOINT (API Documentation)
// ============================================
app.get('/', (req, res) => {
  res.json({
    name: 'Frugano Retail Management API',
    version: '1.0.0',
    description: 'Complete retail management system for fresh produce stores',
    environment: process.env.NODE_ENV || 'production',
    vercel: isVercel,
    timestamp: new Date().toISOString(),
    cors: allowedOrigins,
    documentation: 'https://github.com/your-repo/frugano-backend',
    support: 'support@frugano.com',
    endpoints: {
      public: {
        health: 'GET /health',
        test: 'GET /api/test',
        ping: 'GET /api/ping',
        docs: 'GET /'
      },
      auth: {
        login: 'POST /api/auth/login',
        setup: 'POST /api/auth/setup',
        me: 'GET /api/auth/me',
        logout: 'POST /api/auth/logout',
        changePassword: 'POST /api/auth/change-password'
      },
      upi: {
        generateAmount: 'POST /api/upi/generate-amount',
        generateSale: 'GET /api/upi/qr/:saleId',
        downloadQR: 'GET /api/upi/qr-image/:saleId',
        printerQR: 'GET /api/upi/qr-printer/:saleId',
        verify: 'POST /api/upi/verify'
      },
      users: {
        list: 'GET /api/users',
        get: 'GET /api/users/:id',
        create: 'POST /api/users',
        update: 'PUT /api/users/:id',
        delete: 'DELETE /api/users/:id'
      },
      categories: {
        list: 'GET /api/categories',
        get: 'GET /api/categories/:id',
        create: 'POST /api/categories',
        update: 'PUT /api/categories/:id',
        delete: 'DELETE /api/categories/:id'
      },
      products: {
        list: 'GET /api/products',
        get: 'GET /api/products/:id',
        create: 'POST /api/products',
        update: 'PUT /api/products/:id',
        stock: 'PATCH /api/products/:id/stock',
        bulk: 'POST /api/products/bulk',
        delete: 'DELETE /api/products/:id'
      },
      sales: {
        list: 'GET /api/sales',
        get: 'GET /api/sales/:id',
        invoice: 'GET /api/sales/invoice/:invoiceNo',
        create: 'POST /api/sales',
        void: 'POST /api/sales/:id/void',
        daily: 'GET /api/sales/summary/daily',
        analytics: 'GET /api/sales/analytics'
      },
      purchases: {
        list: 'GET /api/purchases',
        get: 'GET /api/purchases/:id',
        create: 'POST /api/purchases',
        update: 'PUT /api/purchases/:id',
        delete: 'DELETE /api/purchases/:id',
        payments: 'POST /api/purchases/:id/payments'
      },
      suppliers: {
        list: 'GET /api/suppliers',
        get: 'GET /api/suppliers/:id',
        create: 'POST /api/suppliers',
        update: 'PUT /api/suppliers/:id',
        delete: 'DELETE /api/suppliers/:id'
      },
      inventory: {
        status: 'GET /api/inventory/status',
        transactions: 'GET /api/inventory/transactions',
        alerts: 'GET /api/inventory/alerts',
        movement: 'GET /api/inventory/movement',
        resolveAlert: 'PATCH /api/inventory/alerts/:id/resolve'
      },
      customers: {
        list: 'GET /api/customers',
        get: 'GET /api/customers/:id',
        create: 'POST /api/customers',
        update: 'PUT /api/customers/:id',
        delete: 'DELETE /api/customers/:id',
        transactions: 'GET /api/customers/:id/transactions'
      },
      dashboard: {
        summary: 'GET /api/dashboard/summary',
        charts: 'GET /api/dashboard/charts',
        recent: 'GET /api/dashboard/recent'
      },
      campaigns: {
        list: 'GET /api/campaigns',
        get: 'GET /api/campaigns/:id',
        create: 'POST /api/campaigns',
        update: 'PUT /api/campaigns/:id',
        delete: 'DELETE /api/campaigns/:id',
        activate: 'PATCH /api/campaigns/:id/activate',
        deactivate: 'PATCH /api/campaigns/:id/deactivate'
      },
      reports: {
        sales: 'GET /api/reports/sales',
        inventory: 'GET /api/reports/inventory',
        profit: 'GET /api/reports/profit',
        export: 'GET /api/reports/export/:type/:format'
      },
      hardware: {
        printers: 'GET /api/hardware/printers',
        configurePrinter: 'POST /api/hardware/printers',
        testPrinter: 'POST /api/hardware/printers/:id/test',
        print: 'POST /api/hardware/print',
        weighingStatus: 'GET /api/hardware/weighing/status',
        readWeight: 'GET /api/hardware/weighing/read',
        configureWeighing: 'POST /api/hardware/weighing/configure'
      },
      settings: {
        getStore: 'GET /api/settings/store',
        updateStore: 'PUT /api/settings/store',
        backup: 'GET /api/settings/backup',
        restore: 'POST /api/settings/restore'
      },
      print: {
        invoice: 'POST /api/print/invoice/:saleId',
        test: 'POST /api/print/test'
      }
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

// Export for Vercel serverless
module.exports = app;