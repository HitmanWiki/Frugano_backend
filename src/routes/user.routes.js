const express = require('express');
const { body } = require('express-validator');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const userValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['OWNER', 'MANAGER', 'CASHIER', 'INVENTORY_STAFF', 'DELIVERY_BOY']).withMessage('Valid role required')
];

// All routes require authentication
router.use(authenticate);

// Routes - Only OWNER and MANAGER can manage users
router.get('/', authorize('OWNER', 'MANAGER'), getUsers);
router.get('/:id', authorize('OWNER', 'MANAGER'), getUser);
router.post('/', authorize('OWNER', 'MANAGER'), userValidation, validate, createUser);
router.put('/:id', authorize('OWNER', 'MANAGER'), updateUser);
router.delete('/:id', authorize('OWNER'), deleteUser);

module.exports = router;