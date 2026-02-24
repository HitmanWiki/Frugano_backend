const express = require('express');
const { body } = require('express-validator');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  updateStock,
  bulkCreateProducts,
  deleteProduct
} = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const productValidation = [
  body('name').notEmpty().withMessage('Product name is required'),
  body('sku').notEmpty().withMessage('SKU is required'),
  body('categoryId').notEmpty().withMessage('Category is required'),
  body('purchasePrice').isFloat({ min: 0 }).withMessage('Valid purchase price required'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Valid selling price required'),
  body('unit').notEmpty().withMessage('Unit is required')
];

const stockValidation = [
  body('quantity').isFloat({ min: 0 }).withMessage('Valid quantity required'),
  body('type').isIn(['ADD', 'REMOVE', 'SET', 'WASTE']).withMessage('Invalid stock operation')
];

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', authorize('OWNER', 'MANAGER', 'INVENTORY_STAFF'), productValidation, validate, createProduct);
router.post('/bulk', authorize('OWNER', 'MANAGER'), bulkCreateProducts);
router.put('/:id', authorize('OWNER', 'MANAGER', 'INVENTORY_STAFF'), updateProduct);
router.patch('/:id/stock', authorize('INVENTORY_STAFF', 'MANAGER'), stockValidation, validate, updateStock);
router.delete('/:id', authorize('OWNER'), deleteProduct);

module.exports = router;