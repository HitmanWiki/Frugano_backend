const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// Mock settings data (in production, this would come from database)
let storeSettings = {
  storeName: 'Frugano Store',
  phone: '+91 9876543210',
  email: 'store@frugano.com',
  gstNumber: '27AAAAA0000A1Z5',
  address: '123, Retail Street',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  country: 'India',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  taxRate: 5,
  deliveryFee: 40,
  freeDeliveryMin: 500,
  loyaltyPointsRate: 1,
  openingTime: '09:00',
  closingTime: '21:00',
  invoicePrefix: 'INV-',
  invoiceStartNumber: 1001,
  invoiceFooter: 'Thank you for shopping!',
  autoPrintInvoice: true,
  emailInvoice: false,
  autoBackup: false,
  backupFrequency: 'daily',
  backupTime: '02:00',
};

// Get store settings
router.get('/store', authenticate, (req, res) => {
  res.json({
    success: true,
    data: storeSettings
  });
});

// Update store settings
router.put('/store', authenticate, authorize('OWNER', 'MANAGER'), (req, res) => {
  try {
    const updates = req.body;
    
    // Validate required fields
    if (!updates.storeName) {
      return res.status(400).json({ error: 'Store name is required' });
    }

    // Update settings
    storeSettings = {
      ...storeSettings,
      ...updates
    };

    res.json({
      success: true,
      data: storeSettings,
      message: 'Store settings updated successfully'
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Backup database
router.get('/backup', authenticate, authorize('OWNER'), (req, res) => {
  try {
    // In production, this would create a real database backup
    const backupData = {
      timestamp: new Date().toISOString(),
      settings: storeSettings,
      message: 'Demo backup file'
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=frugano-backup-${new Date().toISOString().split('T')[0]}.json`);
    res.json(backupData);
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restore database
router.post('/restore', authenticate, authorize('OWNER'), (req, res) => {
  try {
    const { backupData } = req.body;
    
    // In production, this would restore from backup
    if (backupData) {
      storeSettings = { ...storeSettings, ...backupData.settings };
    }

    res.json({
      success: true,
      message: 'Database restored successfully'
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;