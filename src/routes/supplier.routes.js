const express = require('express');
const { body } = require('express-validator');
const {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier
} = require('../controllers/supplier.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const supplierValidation = [
  body('name').notEmpty().withMessage('Supplier name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').optional().isEmail().withMessage('Valid email required')
];

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', getSuppliers);
router.get('/:id', getSupplier);
router.post('/', authorize('OWNER', 'MANAGER', 'INVENTORY_STAFF'), supplierValidation, validate, createSupplier);
router.put('/:id', authorize('OWNER', 'MANAGER', 'INVENTORY_STAFF'), updateSupplier);
router.delete('/:id', authorize('OWNER'), deleteSupplier);

module.exports = router;