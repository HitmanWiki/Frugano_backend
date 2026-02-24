const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');

const prisma = new PrismaClient();

// @desc    Get all printers
// @route   GET /api/hardware/printers
// @access  Private
const getPrinters = async (req, res) => {
  try {
    const printers = await prisma.hardwareConfig.findMany({
      where: {
        deviceType: 'THERMAL_PRINTER',
        isActive: true
      },
      orderBy: { isDefault: 'desc' }
    });

    res.json({
      success: true,
      data: printers
    });
  } catch (error) {
    console.error('Get printers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Configure printer
// @route   POST /api/hardware/printers
// @access  Private (Owner, Manager)
const configurePrinter = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      deviceName,
      deviceModel,
      connectionType,
      ipAddress,
      port,
      usbVendorId,
      usbProductId,
      isDefault,
      settings
    } = req.body;

    // If this is default, remove default from others
    if (isDefault) {
      await prisma.hardwareConfig.updateMany({
        where: {
          deviceType: 'THERMAL_PRINTER',
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    const printer = await prisma.hardwareConfig.create({
      data: {
        deviceType: 'THERMAL_PRINTER',
        deviceName,
        deviceModel,
        connectionType,
        ipAddress,
        port: port ? parseInt(port) : null,
        usbVendorId,
        usbProductId,
        isDefault: isDefault || false,
        settings: settings || {},
        createdById: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      data: printer
    });
  } catch (error) {
    console.error('Configure printer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Test printer
// @route   POST /api/hardware/printers/:id/test
// @access  Private
const testPrinter = async (req, res) => {
  try {
    const { id } = req.params;

    const printer = await prisma.hardwareConfig.findUnique({
      where: { id }
    });

    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    // Create test print job
    const printJob = await prisma.printJob.create({
      data: {
        hardwareConfigId: id,
        jobType: 'TEST_PAGE',
        document: Buffer.from('Frugano Test Print\n\nIf you can read this, your printer is working correctly!\n\n' + new Date().toLocaleString()).toString('base64'),
        status: 'PENDING'
      }
    });

    // Simulate printing (in production, actual printer communication would happen here)
    setTimeout(async () => {
      await prisma.printJob.update({
        where: { id: printJob.id },
        data: {
          status: 'COMPLETED',
          printedAt: new Date()
        }
      });
    }, 2000);

    res.json({
      success: true,
      message: 'Test print job created',
      data: printJob
    });
  } catch (error) {
    console.error('Test printer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Print receipt
// @route   POST /api/hardware/print
// @access  Private
const printReceipt = async (req, res) => {
  try {
    const { saleId, printerId, copies = 1 } = req.body;

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

    // Get printer
    let printer;
    if (printerId) {
      printer = await prisma.hardwareConfig.findUnique({
        where: { id: printerId }
      });
    } else {
      printer = await prisma.hardwareConfig.findFirst({
        where: {
          deviceType: 'THERMAL_PRINTER',
          isDefault: true,
          isActive: true
        }
      });
    }

    if (!printer) {
      return res.status(404).json({ error: 'No printer configured' });
    }

    // Format receipt
    const receipt = formatReceipt(sale);

    // Create print job
    const printJob = await prisma.printJob.create({
      data: {
        hardwareConfigId: printer.id,
        jobType: 'BILL_RECEIPT',
        document: Buffer.from(receipt).toString('base64'),
        copies,
        status: 'PENDING',
        saleId: sale.id
      }
    });

    res.json({
      success: true,
      message: 'Print job created',
      data: printJob
    });
  } catch (error) {
    console.error('Print receipt error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get weighing machine status
// @route   GET /api/hardware/weighing/status
// @access  Private
const getWeighingStatus = async (req, res) => {
  try {
    const scale = await prisma.hardwareConfig.findFirst({
      where: {
        deviceType: 'WEIGHING_MACHINE',
        isActive: true
      }
    });

    if (!scale) {
      return res.json({
        success: true,
        data: {
          connected: false,
          message: 'No weighing machine configured'
        }
      });
    }

    // In production, actual communication with scale would happen here
    res.json({
      success: true,
      data: {
        connected: true,
        device: scale.deviceName,
        model: scale.deviceModel,
        connectionType: scale.connectionType
      }
    });
  } catch (error) {
    console.error('Get weighing status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Read weight from scale
// @route   GET /api/hardware/weighing/read
// @access  Private
const readWeight = async (req, res) => {
  try {
    const scale = await prisma.hardwareConfig.findFirst({
      where: {
        deviceType: 'WEIGHING_MACHINE',
        isActive: true
      }
    });

    if (!scale) {
      // Create a default scale for testing
      const defaultScale = await prisma.hardwareConfig.create({
        data: {
          deviceType: 'WEIGHING_MACHINE',
          deviceName: 'Default Scale',
          connectionType: 'USB',
          isActive: true,
          createdById: req.user.id
        }
      });
      
      console.log('Created default scale for testing');
    }

    // Simulate weight reading
    const mockWeight = (Math.random() * 5).toFixed(2); // 0-5 kg
    const stable = Math.random() > 0.3;

    // Save measurement
    const measurement = await prisma.weightMeasurement.create({
      data: {
        weight: parseFloat(mockWeight),
        netWeight: parseFloat(mockWeight),
        measuredAt: new Date(),
        measuredBy: req.user.id
      }
    });

    res.json({
      success: true,
      data: {
        weight: parseFloat(mockWeight),
        unit: 'kg',
        stable,
        timestamp: measurement.measuredAt
      }
    });
  } catch (error) {
    console.error('Read weight error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Configure weighing machine
// @route   POST /api/hardware/weighing/configure
// @access  Private (Owner, Manager)
const configureWeighing = async (req, res) => {
  try {
    const {
      deviceName,
      deviceModel,
      connectionType,
      comPort,
      baudRate,
      settings
    } = req.body;

    const scale = await prisma.hardwareConfig.create({
      data: {
        deviceType: 'WEIGHING_MACHINE',
        deviceName,
        deviceModel,
        connectionType,
        comPort,
        baudRate: baudRate || 9600,
        settings: settings || {},
        createdById: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      data: scale
    });
  } catch (error) {
    console.error('Configure weighing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper function to format receipt
function formatReceipt(sale) {
  const lines = [];
  
  // Header
  lines.push('='.repeat(40));
  lines.push('           FRUGANO');
  lines.push('    Freshness Delivered Daily');
  lines.push('='.repeat(40));
  
  // Store info
  lines.push('Store: Main Branch');
  lines.push(`Tel: +91 1234567890`);
  lines.push('='.repeat(40));
  
  // Invoice details
  lines.push(`Invoice: ${sale.invoiceNo}`);
  lines.push(`Date: ${new Date(sale.saleDate).toLocaleString()}`);
  lines.push(`Cashier: ${sale.cashier?.name || 'Unknown'}`);
  if (sale.customerName) {
    lines.push(`Customer: ${sale.customerName}`);
  }
  lines.push('='.repeat(40));
  
  // Items
  lines.push('Item               Qty    Price');
  lines.push('-'.repeat(40));
  
  sale.items.forEach(item => {
    const name = item.product.name.substring(0, 15).padEnd(15);
    const qty = item.quantity.toFixed(2).padStart(6);
    const price = item.total.toFixed(2).padStart(8);
    lines.push(`${name} ${qty} ${price}`);
  });
  
  lines.push('-'.repeat(40));
  
  // Totals
  lines.push(`Subtotal:${sale.subtotal.toFixed(2).padStart(28)}`);
  if (sale.discount > 0) {
    lines.push(`Discount:${sale.discount.toFixed(2).padStart(27)}`);
  }
  lines.push(`Tax:${sale.taxAmount.toFixed(2).padStart(32)}`);
  lines.push(`TOTAL:${sale.totalAmount.toFixed(2).padStart(30)}`);
  lines.push('='.repeat(40));
  
  // Payment
  lines.push(`Payment: ${sale.paymentMethod}`);
  lines.push('='.repeat(40));
  
  // Footer
  lines.push('    Thank you for shopping!');
  lines.push('    Visit us again!');
  lines.push('='.repeat(40));
  lines.push('');
  lines.push('');
  
  return lines.join('\n');
}

module.exports = {
  getPrinters,
  configurePrinter,
  testPrinter,
  printReceipt,
  getWeighingStatus,
  readWeight,
  configureWeighing
};