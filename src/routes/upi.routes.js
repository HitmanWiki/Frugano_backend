const express = require('express');
const router = express.Router();
const upiService = require('../services/upi.service');
const { authenticate } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Generate QR code for order/sale
router.get('/qr/:saleId', authenticate, async (req, res) => {
  try {
    const { saleId } = req.params;

    // Get sale details
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const qrData = await upiService.generateQRCode(
      sale.totalAmount,
      sale.invoiceNo,
      sale.customer?.name
    );

    res.json({
      success: true,
      data: qrData
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate QR code image (for printing)
router.get('/qr-image/:saleId', authenticate, async (req, res) => {
  try {
    const { saleId } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const buffer = await upiService.generateQRCodeBuffer(
      sale.totalAmount,
      sale.invoiceNo
    );

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename=qr-${sale.invoiceNo}.png`);
    res.send(buffer);
  } catch (error) {
    console.error('QR image generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate QR code for printer (ESC/POS format)
router.get('/qr-printer/:saleId', authenticate, async (req, res) => {
  try {
    const { saleId } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const qrCommand = upiService.generateQRCodeForPrinter(
      sale.totalAmount,
      sale.invoiceNo
    );

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=qr-${sale.invoiceNo}.bin`);
    res.send(qrCommand);
  } catch (error) {
    console.error('QR printer command generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Payment callback/webhook
router.post('/callback', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    // Verify webhook signature (implement based on your payment gateway)
    const paymentData = upiService.parsePaymentResponse(req.body);
    
    if (paymentData.success) {
      // Update order status
      await prisma.sale.update({
        where: { invoiceNo: paymentData.orderId },
        data: {
          paymentStatus: 'PAID',
          paymentMethod: 'UPI'
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Payment callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify payment
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { transactionId, amount } = req.body;
    
    const verification = await upiService.verifyPayment(transactionId, amount);
    
    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;