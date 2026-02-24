const express = require('express');
const {
  getInventoryStatus,
  getTransactions,
  getStockAlerts,
  resolveAlert,
  getMovementReport
} = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/status', authorize('OWNER', 'MANAGER', 'INVENTORY_STAFF'), getInventoryStatus);
router.get('/transactions', getTransactions);
router.get('/alerts', getStockAlerts);
router.get('/movement', authorize('OWNER', 'MANAGER'), getMovementReport);
router.patch('/alerts/:id/resolve', authorize('INVENTORY_STAFF', 'MANAGER'), resolveAlert);

module.exports = router;