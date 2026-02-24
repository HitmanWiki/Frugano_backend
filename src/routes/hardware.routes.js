const express = require('express');
const { body } = require('express-validator');
const {
  getPrinters,
  configurePrinter,
  testPrinter,
  printReceipt,
  getWeighingStatus,
  readWeight,
  configureWeighing
} = require('../controllers/hardware.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Validation rules
const printerValidation = [
  body('deviceName').notEmpty().withMessage('Printer name is required'),
  body('connectionType').isIn(['USB', 'NETWORK', 'BLUETOOTH']).withMessage('Valid connection type required')
];

const weighingValidation = [
  body('deviceName').notEmpty().withMessage('Device name is required'),
  body('connectionType').isIn(['USB', 'SERIAL', 'BLUETOOTH']).withMessage('Valid connection type required')
];

// All routes require authentication
router.use(authenticate);

// Printer routes
router.get('/printers', getPrinters);
router.post('/printers', authorize('OWNER', 'MANAGER'), printerValidation, validate, configurePrinter);
router.post('/printers/:id/test', testPrinter);
router.post('/print', printReceipt);

// Weighing machine routes
router.get('/weighing/status', getWeighingStatus);
router.get('/weighing/read', readWeight);
router.post('/weighing/configure', authorize('OWNER', 'MANAGER'), weighingValidation, validate, configureWeighing);

module.exports = router;