const express = require('express');
const {
  getSummary,
  getCharts,
  getRecentActivities
} = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/summary', getSummary);
router.get('/charts', getCharts);
router.get('/recent', getRecentActivities);

module.exports = router;