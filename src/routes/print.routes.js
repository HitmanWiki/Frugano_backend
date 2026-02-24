const express = require('express');
const router = express.Router();
const printerService = require('../services/printer.service');
const { authenticate } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Print invoice
router.post('/invoice/:saleId', authenticate, async (req, res) => {
  try {
    const { saleId } = req.params;
    const { printerId } = req.body;

    // Get sale data
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        cashier: true,
        customer: true
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Get printer configuration
    let printerConfig;
    if (printerId) {
      printerConfig = await prisma.hardwareConfig.findUnique({
        where: { id: printerId }
      });
    } else {
      printerConfig = await prisma.hardwareConfig.findFirst({
        where: {
          deviceType: 'THERMAL_PRINTER',
          isDefault: true,
          isActive: true
        }
      });
    }

    if (!printerConfig) {
      return res.status(404).json({ error: 'No printer configured' });
    }

    // Print invoice
    const result = await printerService.printInvoice(sale, printerConfig);

    res.json({
      success: true,
      message: 'Invoice printed successfully',
      data: result
    });
  } catch (error) {
    console.error('Print error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test printer
router.post('/test', authenticate, async (req, res) => {
  try {
    const { printerId } = req.body;

    const printerConfig = await prisma.hardwareConfig.findUnique({
      where: { id: printerId }
    });

    if (!printerConfig) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    const result = await printerService.testPrinter(printerConfig);

    res.json({
      success: true,
      message: 'Printer test successful'
    });
  } catch (error) {
    console.error('Printer test error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;