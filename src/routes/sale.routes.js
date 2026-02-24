const express = require('express');
const { body } = require('express-validator');
const {
  createSale,
  getSales,
  getSale,
  getSaleByInvoice,
  voidSale,
  getDailySummary,
  getSalesAnalytics
} = require('../controllers/sale.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const saleValidation = [
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.productId').notEmpty().withMessage('Product ID required'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Valid quantity required'),
  body('paymentMethod').notEmpty().withMessage('Payment method required')
];

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', getSales);
router.get('/analytics', authorize('MANAGER', 'OWNER'), getSalesAnalytics);
router.get('/summary/daily', getDailySummary);
router.get('/invoice/:invoiceNo', getSaleByInvoice);
router.get('/:id', getSale);
router.post('/', authorize('CASHIER', 'MANAGER', 'OWNER'), saleValidation, validate, createSale);
router.post('/:id/void', authorize('MANAGER', 'OWNER'), voidSale);

module.exports = router;