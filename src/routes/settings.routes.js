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
  taxRate: 5, // Default 5%
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
  console.log('📤 Sending store settings. Tax rate:', storeSettings.taxRate);
  res.json({
    success: true,
    data: storeSettings
  });
});

// Update store settings
router.put('/store', authenticate, authorize('OWNER', 'MANAGER'), (req, res) => {
  try {
    const updates = req.body;
    
    console.log('📥 Received settings update. Tax rate from request:', updates.taxRate);

    // Validate required fields
    if (!updates.storeName) {
      return res.status(400).json({ error: 'Store name is required' });
    }

    // CRITICAL FIX: Ensure tax rate is properly parsed as a number
    let parsedTaxRate = storeSettings.taxRate; // Default to current value
    
    if (updates.taxRate !== undefined) {
      // Convert to number and handle edge cases
      parsedTaxRate = parseFloat(updates.taxRate);
      
      // Check if it's a valid number
      if (isNaN(parsedTaxRate)) {
        parsedTaxRate = 0; // Default to 0 if invalid
      }
      
      // Ensure it's within range
      if (parsedTaxRate < 0) parsedTaxRate = 0;
      if (parsedTaxRate > 100) parsedTaxRate = 100;
    }

    console.log('✅ Parsed tax rate:', parsedTaxRate);

    // Parse other fields
    const parsedUpdates = {
      storeName: updates.storeName || storeSettings.storeName,
      phone: updates.phone || storeSettings.phone,
      email: updates.email || storeSettings.email,
      gstNumber: updates.gstNumber || storeSettings.gstNumber,
      address: updates.address || storeSettings.address,
      city: updates.city || storeSettings.city,
      state: updates.state || storeSettings.state,
      pincode: updates.pincode || storeSettings.pincode,
      country: updates.country || storeSettings.country,
      currency: updates.currency || storeSettings.currency,
      timezone: updates.timezone || storeSettings.timezone,
      
      // Use the parsed tax rate
      taxRate: parsedTaxRate,
      
      deliveryFee: updates.deliveryFee !== undefined ? parseFloat(updates.deliveryFee) : storeSettings.deliveryFee,
      freeDeliveryMin: updates.freeDeliveryMin !== undefined ? parseFloat(updates.freeDeliveryMin) : storeSettings.freeDeliveryMin,
      loyaltyPointsRate: updates.loyaltyPointsRate !== undefined ? parseInt(updates.loyaltyPointsRate) : storeSettings.loyaltyPointsRate,
      openingTime: updates.openingTime || storeSettings.openingTime,
      closingTime: updates.closingTime || storeSettings.closingTime,
      invoicePrefix: updates.invoicePrefix || storeSettings.invoicePrefix,
      invoiceStartNumber: updates.invoiceStartNumber !== undefined ? parseInt(updates.invoiceStartNumber) : storeSettings.invoiceStartNumber,
      invoiceFooter: updates.invoiceFooter || storeSettings.invoiceFooter,
      autoPrintInvoice: updates.autoPrintInvoice !== undefined ? Boolean(updates.autoPrintInvoice) : storeSettings.autoPrintInvoice,
      emailInvoice: updates.emailInvoice !== undefined ? Boolean(updates.emailInvoice) : storeSettings.emailInvoice,
      autoBackup: updates.autoBackup !== undefined ? Boolean(updates.autoBackup) : storeSettings.autoBackup,
      backupFrequency: updates.backupFrequency || storeSettings.backupFrequency,
      backupTime: updates.backupTime || storeSettings.backupTime,
    };

    // Validate ranges
    if (parsedUpdates.taxRate < 0 || parsedUpdates.taxRate > 100) {
      return res.status(400).json({ error: 'Tax rate must be between 0 and 100' });
    }

    // Update settings
    storeSettings = {
      ...storeSettings,
      ...parsedUpdates
    };

    console.log('💾 Updated store settings. New tax rate:', storeSettings.taxRate);

    res.json({
      success: true,
      data: storeSettings,
      message: 'Store settings updated successfully'
    });
  } catch (error) {
    console.error('❌ Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check tax rate
router.get('/debug-tax', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      taxRate: storeSettings.taxRate,
      taxRateType: typeof storeSettings.taxRate,
      allSettings: storeSettings
    }
  });
});

// Backup database
router.get('/backup', authenticate, authorize('OWNER'), (req, res) => {
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      settings: storeSettings,
      version: '1.0.0',
      type: 'full_backup',
      message: 'Database backup'
    };

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

    if (!backupData.settings || !backupData.timestamp) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }
    
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

// Reset to defaults
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