const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// Print invoice (or generate PDF)
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

    // Try to get printer configuration
    let printerConfig = null;
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

    // If no printer configured or on Vercel, generate PDF
    if (!printerConfig || process.env.VERCEL === '1') {
      return await generatePDF(sale, res);
    }

    // Here you would integrate with actual printer service
    // For now, generate PDF as fallback
    return await generatePDF(sale, res);

  } catch (error) {
    console.error('Print error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate PDF invoice
async function generatePDF(sale, res) {
  const doc = new PDFDocument({ margin: 50 });
  
  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${sale.invoiceNo}.pdf`);
  
  doc.pipe(res);

  // Header
  doc.fontSize(20).text('FRUGANO', { align: 'center' });
  doc.fontSize(12).text('Freshness Delivered Daily', { align: 'center' });
  doc.moveDown();
  doc.text('='.repeat(50), { align: 'center' });
  doc.moveDown();

  // Invoice details
  doc.fontSize(10);
  doc.text(`Invoice No: ${sale.invoiceNo}`);
  doc.text(`Date: ${new Date(sale.saleDate).toLocaleString()}`);
  doc.text(`Cashier: ${sale.cashier?.name || 'Unknown'}`);
  if (sale.customerName) {
    doc.text(`Customer: ${sale.customerName}`);
  }
  if (sale.customerPhone) {
    doc.text(`Phone: ${sale.customerPhone}`);
  }
  doc.moveDown();
  doc.text('='.repeat(50), { align: 'center' });
  doc.moveDown();

  // Items
  sale.items.forEach(item => {
    const name = item.product?.name || 'Unknown';
    const qty = item.quantity;
    const price = item.sellingPrice;
    const total = item.total;
    doc.text(`${name} x${qty} @ ₹${price} = ₹${total}`);
  });

  doc.moveDown();
  doc.text('='.repeat(50), { align: 'center' });
  doc.moveDown();

  // Totals
  doc.text(`Subtotal: ₹${sale.subtotal.toFixed(2)}`, { align: 'right' });
  if (sale.discount > 0) {
    doc.text(`Discount: -₹${sale.discount.toFixed(2)}`, { align: 'right' });
  }
  doc.text(`Tax: ₹${sale.taxAmount.toFixed(2)}`, { align: 'right' });
  doc.fontSize(12).text(`TOTAL: ₹${sale.totalAmount.toFixed(2)}`, { align: 'right' });
  doc.moveDown();
  doc.text('='.repeat(50), { align: 'center' });
  doc.moveDown();

  // Payment
  doc.text(`Payment Method: ${sale.paymentMethod}`, { align: 'center' });
  doc.moveDown();
  doc.text('Thank you for shopping with Frugano!', { align: 'center' });
  doc.text('Visit us again!', { align: 'center' });

  doc.end();
}

// Get printable version (HTML)
router.get('/:saleId', authenticate, async (req, res) => {
  try {
    const { saleId } = req.params;

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

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;