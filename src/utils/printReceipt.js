// backend/src/utils/printReceipt.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function printReceipt(saleData, printerConfig) {
  try {
    // Format receipt for printing
    const receipt = formatReceipt(saleData);
    
    // If using network printer with IPP
    if (printerConfig.connectionType === 'NETWORK') {
      // Use IPP protocol or send to printer's HTTP interface
      await axios.post(`http://${printerConfig.ipAddress}:${printerConfig.port}/print`, {
        data: receipt,
        copies: 1
      });
    }
    
    // Save print job
    await prisma.printJob.create({
      data: {
        hardwareConfigId: printerConfig.id,
        jobType: 'BILL_RECEIPT',
        document: receipt,
        status: 'COMPLETED',
        printedAt: new Date()
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Print error:', error);
    
    // Save failed print job
    await prisma.printJob.create({
      data: {
        hardwareConfigId: printerConfig.id,
        jobType: 'BILL_RECEIPT',
        document: receipt,
        status: 'FAILED',
        error: error.message
      }
    });
    
    return { success: false, error: error.message };
  }
}

function formatReceipt(saleData) {
  return `
    FRUGANO
    Freshness Delivered Daily
    ========================
    Invoice: ${saleData.invoiceNo}
    Date: ${new Date().toLocaleString()}
    Cashier: ${saleData.cashierName}
    ========================
    ${saleData.items.map(item => 
      `${item.name} x${item.qty}   ₹${item.total}`
    ).join('\n')}
    ========================
    Subtotal: ₹${saleData.subtotal}
    Discount: ₹${saleData.discount}
    Tax: ₹${saleData.tax}
    TOTAL: ₹${saleData.total}
    ========================
    Payment: ${saleData.paymentMethod}
    ========================
    Thank you for shopping!
    Visit again!
  `;
}

module.exports = { printReceipt };