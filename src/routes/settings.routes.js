const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Path to store settings file
const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Default settings
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

// Load settings from file or use defaults
let storeSettings = loadSettings();

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const loaded = JSON.parse(data);
      console.log('📂 Loaded settings from file:', loaded);
      return { ...defaultSettings, ...loaded };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  console.log('📋 Using default settings');
  return { ...defaultSettings };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log('💾 Settings saved to file');
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

// PUBLIC endpoint - no authentication needed
router.get('/public/tax-rate', (req, res) => {
  console.log('📢 Public tax rate check - Current tax rate:', storeSettings.taxRate);
  res.json({
    success: true,
    data: {
      taxRate: storeSettings.taxRate,
      taxRateType: typeof storeSettings.taxRate,
      storeName: storeSettings.storeName,
      timestamp: new Date().toISOString()
    }
  });
});

// Get store settings (authenticated)
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
    
    console.log('📥 Received settings update. Full request body:', updates);
    console.log('📥 Tax rate from request:', updates.taxRate);

    // Validate required fields
    if (!updates.storeName) {
      return res.status(400).json({ error: 'Store name is required' });
    }

    // Create updated settings object
    const updatedSettings = {
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
      
      // CRITICAL: Handle tax rate properly, especially when it's 0
      taxRate: updates.taxRate !== undefined ? parseFloat(updates.taxRate) : storeSettings.taxRate,
      
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

    // Validate tax rate
    if (isNaN(updatedSettings.taxRate)) {
      updatedSettings.taxRate = 0;
    }
    if (updatedSettings.taxRate < 0) updatedSettings.taxRate = 0;
    if (updatedSettings.taxRate > 100) updatedSettings.taxRate = 100;

    console.log('✅ Updated settings object:', updatedSettings);
    console.log('✅ Tax rate being saved:', updatedSettings.taxRate);

    // Save to file
    storeSettings = updatedSettings;
    const saved = saveSettings(storeSettings);

    if (!saved) {
      return res.status(500).json({ error: 'Failed to save settings' });
    }

    console.log('💾 Settings saved successfully. New tax rate:', storeSettings.taxRate);

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

// Reset to defaults
router.post('/reset', authenticate, authorize('OWNER'), (req, res) => {
  try {
    storeSettings = { ...defaultSettings };
    saveSettings(storeSettings);

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