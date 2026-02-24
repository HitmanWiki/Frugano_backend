const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const { createServer } = require('http');
const fs = require('fs');

// Load env variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/category.routes');
const productRoutes = require('./routes/product.routes');
const saleRoutes = require('./routes/sale.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const supplierRoutes = require('./routes/supplier.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const customerRoutes = require('./routes/customer.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const campaignRoutes = require('./routes/campaign.routes');
const reportRoutes = require('./routes/report.routes');
const hardwareRoutes = require('./routes/hardware.routes');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');

// Detect if running on Vercel
const isVercel = process.env.VERCEL === '1';
console.log(`🚀 Running on ${isVercel ? 'Vercel' : 'Local'} environment`);

const app = express();
const httpServer = createServer(app);

// Allowed origins for CORS - ensure NO trailing slashes
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://frugano-frontend.vercel.app',
  'https://frugano-admin.vercel.app',
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null
].filter(Boolean);

console.log('🔓 CORS Allowed Origins:', allowedOrigins);

// CORS configuration - MUST be first middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    // Remove trailing slash from origin for comparison
    const cleanOrigin = origin.replace(/\/$/, '');
    
    if (allowedOrigins.includes(cleanOrigin)) {
      callback(null, origin);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests explicitly
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

// Only initialize Socket.io in non-Vercel environments
let io = null;
if (!isVercel) {
  try {
    const { Server } = require('socket.io');
    io = new Server(httpServer, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
      },
      transports: ['websocket', 'polling']
    });

    // Make io accessible to routes
    app.set('io', io);

    // WebSocket connection handling
    io.on('connection', (socket) => {
      console.log('🔌 New client connected:', socket.id);
      
      socket.on('join-store', (storeId) => {
        socket.join(`store-${storeId}`);
        console.log(`Client ${socket.id} joined store ${storeId}`);
      });
      
      socket.on('new-sale', (data) => {
        io.to(`store-${data.storeId}`).emit('sale-updated', {
          type: 'NEW_SALE',
          data: data,
          timestamp: new Date()
        });
      });
      
      socket.on('stock-update', (data) => {
        io.to(`store-${data.storeId}`).emit('inventory-updated', {
          type: 'STOCK_UPDATE',
          data: data,
          timestamp: new Date()
        });
      });
      
      socket.on('low-stock-alert', (data) => {
        io.to(`store-${data.storeId}`).emit('alert', {
          type: 'LOW_STOCK',
          data: data,
          timestamp: new Date()
        });
      });
      
      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });
  } catch (error) {
    console.log('⚠️ Socket.io initialization failed:', error.message);
  }
} else {
  console.log('🔌 WebSocket disabled on Vercel (use polling instead)');
}

// Static files - Handle uploads differently for Vercel
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '../uploads');
const invoicesDir = path.join(uploadsDir, 'invoices');
const barcodesDir = path.join(uploadsDir, 'barcodes');
const productsDir = path.join(uploadsDir, 'products');

// Create directories if they don't exist
try {
  [uploadsDir, invoicesDir, barcodesDir, productsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
} catch (error) {
  console.log(`⚠️ Cannot create directories: ${error.message}`);
}

// Only serve static files if directory exists and we're not on Vercel
if (!isVercel && fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
} else {
  // Mock uploads endpoint for Vercel
  app.get('/uploads/*', (req, res) => {
    res.status(404).json({ error: 'File uploads not available in serverless mode' });
  });
}

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// HEALTH CHECK ENDPOINTS (Public)
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected',
    websocket: !isVercel && io ? 'active' : 'disabled (serverless)',
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0',
    vercel: isVercel
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL
  });
});

app.get('/api/ping', (req, res) => {
  res.json({ 
    message: 'pong', 
    time: new Date().toISOString() 
  });
});

// Debug routes endpoint (temporary)
app.get('/api/debug-routes', (req, res) => {
  const routes = [];
  
  // Collect all registered routes
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      // Routes registered directly
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      // Routes from router middleware
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          const path = handler.route.path;
          const methods = Object.keys(handler.route.methods);
          routes.push({ path, methods });
        }
      });
    }
  });
  
  res.json({
    message: 'Registered Routes',
    count: routes.length,
    routes: routes,
    env: process.env.NODE_ENV,
    hasAuthRoutes: routes.some(r => r.path.includes('auth') || r.path.includes('/login'))
  });
});

// Database test endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Try to query the database
    const userCount = await prisma.user.count();
    
    await prisma.$disconnect();
    
    res.json({ 
      success: true, 
      message: 'Database connected',
      userCount,
      databaseUrl: process.env.DATABASE_URL ? 'Set (hidden)' : 'NOT SET'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.code,
      databaseUrl: process.env.DATABASE_URL ? 'Set (hidden)' : 'NOT SET'
    });
  }
});

// ============================================
// API ROUTES - Mount all routes here
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
        debug: 'GET /api/debug-routes',
        dbTest: 'GET /api/db-test',
        docs: 'GET /',
        setup: 'POST /api/auth/setup'
      },
      auth: {
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me (Auth)',
        logout: 'POST /api/auth/logout (Auth)',
        changePassword: 'POST /api/auth/change-password (Auth)'
      },
      users: {
        list: 'GET /api/users (Owner, Manager)',
        get: 'GET /api/users/:id (Owner, Manager)',
        create: 'POST /api/users (Owner, Manager)',
        update: 'PUT /api/users/:id (Owner, Manager)',
        delete: 'DELETE /api/users/:id (Owner)'
      },
      categories: {
        list: 'GET /api/categories',
        get: 'GET /api/categories/:id',
        create: 'POST /api/categories (Manager+)',
        update: 'PUT /api/categories/:id (Manager+)',
        delete: 'DELETE /api/categories/:id (Owner)'
      },
      products: {
        list: 'GET /api/products',
        get: 'GET /api/products/:id',
        create: 'POST /api/products (Inventory+)',
        update: 'PUT /api/products/:id (Inventory+)',
        stock: 'PATCH /api/products/:id/stock (Inventory+)',
        bulk: 'POST /api/products/bulk (Manager+)',
        delete: 'DELETE /api/products/:id (Owner)'
      },
      sales: {
        list: 'GET /api/sales',
        get: 'GET /api/sales/:id',
        invoice: 'GET /api/sales/invoice/:invoiceNo',
        create: 'POST /api/sales (Cashier+)',
        void: 'POST /api/sales/:id/void (Manager+)',
        daily: 'GET /api/sales/summary/daily',
        analytics: 'GET /api/sales/analytics (Manager+)'
      },
      purchases: {
        list: 'GET /api/purchases',
        get: 'GET /api/purchases/:id',
        create: 'POST /api/purchases (Inventory+)',
        update: 'PUT /api/purchases/:id (Manager+)',
        delete: 'DELETE /api/purchases/:id (Owner)',
        payments: 'POST /api/purchases/:id/payments (Manager+)'
      },
      suppliers: {
        list: 'GET /api/suppliers',
        get: 'GET /api/suppliers/:id',
        create: 'POST /api/suppliers (Inventory+)',
        update: 'PUT /api/suppliers/:id (Inventory+)',
        delete: 'DELETE /api/suppliers/:id (Owner)'
      },
      inventory: {
        status: 'GET /api/inventory/status',
        transactions: 'GET /api/inventory/transactions',
        alerts: 'GET /api/inventory/alerts',
        movement: 'GET /api/inventory/movement (Manager+)',
        resolveAlert: 'PATCH /api/inventory/alerts/:id/resolve (Inventory+)'
      },
      customers: {
        list: 'GET /api/customers',
        get: 'GET /api/customers/:id',
        create: 'POST /api/customers (Cashier+)',
        update: 'PUT /api/customers/:id (Cashier+)',
        delete: 'DELETE /api/customers/:id (Manager+)',
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
        create: 'POST /api/campaigns (Manager+)',
        update: 'PUT /api/campaigns/:id (Manager+)',
        delete: 'DELETE /api/campaigns/:id (Owner)',
        activate: 'PATCH /api/campaigns/:id/activate (Manager+)',
        deactivate: 'PATCH /api/campaigns/:id/deactivate (Manager+)'
      },
      reports: {
        sales: 'GET /api/reports/sales',
        inventory: 'GET /api/reports/inventory',
        profit: 'GET /api/reports/profit',
        export: 'GET /api/reports/export/:type/:format'
      },
      hardware: {
        printers: 'GET /api/hardware/printers',
        configurePrinter: 'POST /api/hardware/printers (Manager+)',
        testPrinter: 'POST /api/hardware/printers/:id/test',
        print: 'POST /api/hardware/print',
        weighingStatus: 'GET /api/hardware/weighing/status',
        readWeight: 'GET /api/hardware/weighing/read',
        configureWeighing: 'POST /api/hardware/weighing/configure (Manager+)'
      }
    }
  });
});

// ============================================
// 404 HANDLER - Must be last!
// ============================================
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

// ============================================
// SERVER STARTUP (Local only)
// ============================================
if (!isVercel) {
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 FRUGANO RETAIL MANAGEMENT SYSTEM');
    console.log('='.repeat(70));
    console.log(`📍 Server:     http://localhost:${PORT}`);
    console.log(`📊 Database:   Neon PostgreSQL`);
    console.log(`🔌 WebSocket:  ${io ? 'Active' : 'Disabled'}`);
    console.log(`📁 Uploads:    ${uploadsDir}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔓 CORS:       ${allowedOrigins.join(', ')}`);
    console.log('='.repeat(70) + '\n');
  });
}

// Graceful shutdown (only for local)
process.on('SIGTERM', () => {
  if (!isVercel) {
    console.log('\n🛑 SIGTERM received: closing server...');
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  }
});

process.on('SIGINT', () => {
  if (!isVercel) {
    console.log('\n🛑 SIGINT received: closing server...');
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export for Vercel serverless
module.exports = app;