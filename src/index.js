
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

// Only initialize Socket.io in non-Vercel environments
let io = null;
if (!isVercel) {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
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
} else {
  console.log('🔌 WebSocket disabled on Vercel (use polling instead)');
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173']
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logging
app.use(morgan('combined'));

// Body parser
app.use(express.json({ limit: '10mb' })); // Reduced limit for Vercel
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - Handle uploads differently for Vercel
const uploadsDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '../uploads');
const invoicesDir = path.join(uploadsDir, 'invoices');
const barcodesDir = path.join(uploadsDir, 'barcodes');
const productsDir = path.join(uploadsDir, 'products');

// Create directories if they don't exist (only attempt in non-Vercel or if /tmp is writable)
try {
  [uploadsDir, invoicesDir, barcodesDir, productsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
} catch (error) {
  console.log(`⚠️ Cannot create directories: ${error.message}`);
  console.log('📁 File uploads will need cloud storage in production');
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

// API Routes
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

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected',
    websocket: !isVercel ? 'active' : 'disabled (serverless)',
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0',
    vercel: isVercel
  });
});

// API Documentation (public)
app.get('/', (req, res) => {
  res.json({
    name: 'Frugano Retail Management API',
    version: '1.0.0',
    description: 'Complete retail management system for fresh produce stores',
    environment: process.env.NODE_ENV || 'production',
    vercel: isVercel,
    timestamp: new Date().toISOString(),
    endpoints: {
      public: {
        health: 'GET /health',
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

// For local development
if (!isVercel) {
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 FRUGANO RETAIL MANAGEMENT SYSTEM');
    console.log('='.repeat(70));
    console.log(`📍 Server:     http://localhost:${PORT}`);
    console.log(`📊 Database:   Neon PostgreSQL`);
    console.log(`🔌 WebSocket:  Active on same port`);
    console.log(`📁 Uploads:    ${uploadsDir}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
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