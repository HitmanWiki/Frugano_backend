const express = require('express');
const { body } = require('express-validator');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerTransactions
} = require('../controllers/customer.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const customerValidation = [
  body('name').notEmpty().withMessage('Customer name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('email').optional().isEmail().withMessage('Valid email required')
];

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.get('/:id/transactions', getCustomerTransactions);
router.post('/', authorize('CASHIER', 'MANAGER', 'OWNER'), customerValidation, validate, createCustomer);
router.put('/:id', authorize('CASHIER', 'MANAGER', 'OWNER'), updateCustomer);
router.delete('/:id', authorize('MANAGER', 'OWNER'), deleteCustomer);

module.exports = router;