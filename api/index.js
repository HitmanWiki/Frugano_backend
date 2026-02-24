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

// CORS configuration for production
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://your-frontend.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
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

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export for serverless
module.exports = app;