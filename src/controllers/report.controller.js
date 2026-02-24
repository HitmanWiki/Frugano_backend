const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const prisma = new PrismaClient();

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private (Manager, Owner)
const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, period = 'month' } = req.query;

    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();

    if (!startDate && !endDate) {
      switch (period) {
        case 'week':
          start.setDate(start.getDate() - 7);
          break;
        case 'month':
          start.setMonth(start.getMonth() - 1);
          break;
        case 'quarter':
          start.setMonth(start.getMonth() - 3);
          break;
        case 'year':
          start.setFullYear(start.getFullYear() - 1);
          break;
      }
    }

    const sales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: start,
          lte: end
        },
        paymentStatus: { not: 'CANCELLED' }
      },
      include: {
        cashier: {
          select: { name: true }
        },
        items: {
          include: {
            product: {
              select: { name: true, sku: true }
            }
          }
        }
      },
      orderBy: { saleDate: 'desc' }
    });

    const summary = {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + s.totalAmount, 0),
      totalDiscount: sales.reduce((sum, s) => sum + s.discount, 0),
      totalTax: sales.reduce((sum, s) => sum + s.taxAmount, 0),
      averageTicket: sales.length > 0 
        ? sales.reduce((sum, s) => sum + s.totalAmount, 0) / sales.length 
        : 0
    };

    res.json({
      success: true,
      data: {
        period: { start, end },
        summary,
        sales
      }
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get inventory report
// @route   GET /api/reports/inventory
// @access  Private (Manager, Owner)
const getInventoryReport = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        stockAlerts: {
          where: { status: 'ACTIVE' }
        }
      },
      orderBy: { name: 'asc' }
    });

    const summary = {
      totalProducts: products.length,
      totalValue: products.reduce((sum, p) => sum + (p.currentStock * p.purchasePrice), 0),
      totalRetailValue: products.reduce((sum, p) => sum + (p.currentStock * p.sellingPrice), 0),
      lowStock: products.filter(p => p.currentStock <= p.minStockAlert).length,
      outOfStock: products.filter(p => p.currentStock === 0).length
    };

    res.json({
      success: true,
      data: {
        summary,
        products
      }
    });
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get profit report
// @route   GET /api/reports/profit
// @access  Private (Owner)
const getProfitReport = async (req, res) => {
  try {
    const { startDate, endDate, period = 'month' } = req.query;

    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();

    if (!startDate && !endDate) {
      switch (period) {
        case 'week':
          start.setDate(start.getDate() - 7);
          break;
        case 'month':
          start.setMonth(start.getMonth() - 1);
          break;
        case 'quarter':
          start.setMonth(start.getMonth() - 3);
          break;
        case 'year':
          start.setFullYear(start.getFullYear() - 1);
          break;
      }
    }

    // Get sales data
    const sales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: start,
          lte: end
        },
        paymentStatus: { not: 'CANCELLED' }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Get purchase data
    const purchases = await prisma.purchase.findMany({
      where: {
        purchaseDate: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: true
      }
    });

    // Calculate profit
    let totalRevenue = 0;
    let totalCost = 0;
    let totalDiscount = 0;

    sales.forEach(sale => {
      totalRevenue += sale.totalAmount;
      totalDiscount += sale.discount;
      
      sale.items.forEach(item => {
        totalCost += (item.quantity * item.product.purchasePrice);
      });
    });

    purchases.forEach(purchase => {
      totalCost += purchase.netAmount;
    });

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalDiscount;

    res.json({
      success: true,
      data: {
        period: { start, end },
        summary: {
          totalRevenue,
          totalCost,
          grossProfit,
          totalDiscount,
          netProfit,
          margin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('Profit report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Export report
// @route   GET /api/reports/export/:type/:format
// @access  Private (Manager, Owner)
const exportReport = async (req, res) => {
  try {
    const { type, format } = req.params;
    const { startDate, endDate } = req.query;

    let data;
    let filename = `${type}-report-${Date.now()}`;

    // Get report data based on type
    switch (type) {
      case 'sales':
        data = await getSalesReportData(startDate, endDate);
        break;
      case 'inventory':
        data = await getInventoryReportData();
        break;
      case 'profit':
        data = await getProfitReportData(startDate, endDate);
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    // Export based on format
    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');

      // Add headers
      const headers = Object.keys(data[0] || {});
      worksheet.addRow(headers);

      // Add data
      data.forEach(item => {
        worksheet.addRow(Object.values(item));
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      const doc = new PDFDocument();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);

      doc.pipe(res);
      
      // Add content to PDF
      doc.fontSize(16).text(`${type.toUpperCase()} Report`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      data.forEach((item, index) => {
        doc.text(`${index + 1}. ${JSON.stringify(item)}`);
      });

      doc.end();
    } else {
      res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper functions
async function getSalesReportData(startDate, endDate) {
  const sales = await prisma.sale.findMany({
    where: {
      saleDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    },
    include: {
      cashier: { select: { name: true } }
    }
  });

  return sales.map(s => ({
    InvoiceNo: s.invoiceNo,
    Date: s.saleDate.toLocaleDateString(),
    Amount: s.totalAmount,
    PaymentMethod: s.paymentMethod,
    Cashier: s.cashier?.name || 'Unknown'
  }));
}

async function getInventoryReportData() {
  const products = await prisma.product.findMany({
    include: { category: true }
  });

  return products.map(p => ({
    Name: p.name,
    SKU: p.sku,
    Category: p.category?.name || 'Uncategorized',
    Stock: p.currentStock,
    Unit: p.unit,
    PurchasePrice: p.purchasePrice,
    SellingPrice: p.sellingPrice,
    Value: p.currentStock * p.purchasePrice
  }));
}

async function getProfitReportData(startDate, endDate) {
  // Similar to getProfitReport but returns array for export
  return [];
}

module.exports = {
  getSalesReport,
  getInventoryReport,
  getProfitReport,
  exportReport
};