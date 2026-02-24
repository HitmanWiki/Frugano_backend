const express = require('express');
const { body } = require('express-validator');
const {
  getPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  addPayment
} = require('../controllers/purchase.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const purchaseValidation = [
  body('supplierId').notEmpty().withMessage('Supplier ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.productId').notEmpty().withMessage('Product ID required'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Valid quantity required'),
  body('items.*.purchasePrice').isFloat({ min: 0 }).withMessage('Valid purchase price required')
];

const paymentValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
  body('paymentMethod').notEmpty().withMessage('Payment method required')
];

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', getPurchases);
router.get('/:id', getPurchase);
router.post('/', authorize('OWNER', 'MANAGER', 'INVENTORY_STAFF'), purchaseValidation, validate, createPurchase);
router.put('/:id', authorize('OWNER', 'MANAGER'), updatePurchase);
router.delete('/:id', authorize('OWNER'), deletePurchase);
router.post('/:id/payments', authorize('OWNER', 'MANAGER'), paymentValidation, validate, addPayment);

module.exports = router;