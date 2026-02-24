const express = require('express');
const { body } = require('express-validator');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/category.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const categoryValidation = [
  body('name').notEmpty().withMessage('Category name is required'),
  body('description').optional()
];

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', getCategories);
router.get('/:id', getCategory);
router.post('/', authorize('OWNER', 'MANAGER'), categoryValidation, validate, createCategory);
router.put('/:id', authorize('OWNER', 'MANAGER'), categoryValidation, validate, updateCategory);
router.delete('/:id', authorize('OWNER'), deleteCategory);

module.exports = router;