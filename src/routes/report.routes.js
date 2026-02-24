const express = require('express');
const {
  getSalesReport,
  getInventoryReport,
  getProfitReport,
  exportReport
} = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/sales', authorize('MANAGER', 'OWNER'), getSalesReport);
router.get('/inventory', authorize('MANAGER', 'OWNER'), getInventoryReport);
router.get('/profit', authorize('OWNER'), getProfitReport);
router.get('/export/:type/:format', authorize('MANAGER', 'OWNER'), exportReport);

module.exports = router;