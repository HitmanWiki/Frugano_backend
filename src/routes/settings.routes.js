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

    // Validate and parse numeric fields
    const parsedUpdates = {
      ...updates,
      taxRate: updates.taxRate !== undefined ? parseFloat(updates.taxRate) : storeSettings.taxRate,
      deliveryFee: updates.deliveryFee !== undefined ? parseFloat(updates.deliveryFee) : storeSettings.deliveryFee,
      freeDeliveryMin: updates.freeDeliveryMin !== undefined ? parseFloat(updates.freeDeliveryMin) : storeSettings.freeDeliveryMin,
      loyaltyPointsRate: updates.loyaltyPointsRate !== undefined ? parseInt(updates.loyaltyPointsRate) : storeSettings.loyaltyPointsRate,
      invoiceStartNumber: updates.invoiceStartNumber !== undefined ? parseInt(updates.invoiceStartNumber) : storeSettings.invoiceStartNumber,
      autoPrintInvoice: updates.autoPrintInvoice !== undefined ? Boolean(updates.autoPrintInvoice) : storeSettings.autoPrintInvoice,
      emailInvoice: updates.emailInvoice !== undefined ? Boolean(updates.emailInvoice) : storeSettings.emailInvoice,
      autoBackup: updates.autoBackup !== undefined ? Boolean(updates.autoBackup) : storeSettings.autoBackup,
    };

    // Validate numeric ranges
    if (parsedUpdates.taxRate < 0 || parsedUpdates.taxRate > 100) {
      return res.status(400).json({ error: 'Tax rate must be between 0 and 100' });
    }

    if (parsedUpdates.deliveryFee < 0) {
      return res.status(400).json({ error: 'Delivery fee cannot be negative' });
    }

    if (parsedUpdates.freeDeliveryMin < 0) {
      return res.status(400).json({ error: 'Free delivery minimum cannot be negative' });
    }

    if (parsedUpdates.loyaltyPointsRate < 0) {
      return res.status(400).json({ error: 'Loyalty points rate cannot be negative' });
    }

    if (parsedUpdates.invoiceStartNumber < 1) {
      return res.status(400).json({ error: 'Invoice start number must be positive' });
    }

    // Update settings
    storeSettings = {
      ...storeSettings,
      ...parsedUpdates
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
      version: '1.0.0',
      type: 'full_backup',
      message: 'Database backup'
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=frugano-backup-${new Date().toISOString().split('T')[0]}.json`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
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
    
    if (!backupData) {
      return res.status(400).json({ error: 'No backup data provided' });
    }

    // Validate backup data structure
    if (!backupData.settings || !backupData.timestamp) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }
    
    // In production, this would restore from backup
    storeSettings = { 
      ...storeSettings, 
      ...backupData.settings 
    };

    res.json({
      success: true,
      message: 'Database restored successfully',
      restoredAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset to defaults (admin only)
router.post('/reset', authenticate, authorize('OWNER'), (req, res) => {
  try {
    const defaultSettings = {
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

    storeSettings = defaultSettings;

    res.json({
      success: true,
      message: 'Settings reset to defaults',
      data: storeSettings
    });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;