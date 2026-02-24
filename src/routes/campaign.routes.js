const express = require('express');
const { body } = require('express-validator');
const {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  activateCampaign,
  deactivateCampaign
} = require('../controllers/campaign.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const campaignValidation = [
  body('name').notEmpty().withMessage('Campaign name is required'),
  body('type').notEmpty().withMessage('Campaign type is required'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').isISO8601().withMessage('Valid end date required'),
  body('discountType').notEmpty().withMessage('Discount type is required'),
  body('discountValue').isFloat({ min: 0 }).withMessage('Valid discount value required')
];

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', getCampaigns);
router.get('/:id', getCampaign);
router.post('/', authorize('OWNER', 'MANAGER'), campaignValidation, validate, createCampaign);
router.put('/:id', authorize('OWNER', 'MANAGER'), updateCampaign);
router.delete('/:id', authorize('OWNER'), deleteCampaign);
router.patch('/:id/activate', authorize('OWNER', 'MANAGER'), activateCampaign);
router.patch('/:id/deactivate', authorize('OWNER', 'MANAGER'), deactivateCampaign);

module.exports = router;