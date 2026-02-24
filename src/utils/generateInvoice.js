const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class InvoiceGenerator {
  constructor() {
    this.invoiceDir = path.join(__dirname, '../../uploads/invoices');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(this.invoiceDir)) {
      fs.mkdirSync(this.invoiceDir, { recursive: true });
    }
  }

  async generateInvoice(sale) {
    return new Promise((resolve, reject) => {
      try {
        const filename = `invoice-${sale.invoiceNo}-${Date.now()}.pdf`;
        const filepath = path.join(this.invoiceDir, filename);
        
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);
        
        doc.pipe(stream);

        // Header
        doc.fontSize(25)
           .font('Helvetica-Bold')
           .text('FRUGANO', 50, 50)
           .fontSize(12)
           .font('Helvetica')
           .text('Freshness Delivered Daily', 50, 80)
           .moveDown();

        // Invoice details
        doc.fontSize(10)
           .text(`Invoice #: ${sale.invoiceNo}`, 50, 120)
           .text(`Date: ${new Date(sale.saleDate).toLocaleDateString()}`, 50, 135)
           .text(`Time: ${new Date(sale.saleDate).toLocaleTimeString()}`, 50, 150)
           .text(`Cashier: ${sale.cashier?.name || 'Unknown'}`, 50, 165);

        // Customer details
        if (sale.customerName) {
          doc.text(`Customer: ${sale.customerName}`, 300, 120);
          if (sale.customerPhone) {
            doc.text(`Phone: ${sale.customerPhone}`, 300, 135);
          }
        }

        // Line
        doc.moveTo(50, 200)
           .lineTo(550, 200)
           .stroke();

        // Table header
        const tableTop = 220;
        doc.font('Helvetica-Bold')
           .text('Item', 50, tableTop)
           .text('Qty', 300, tableTop)
           .text('Price', 400, tableTop)
           .text('Total', 480, tableTop);

        doc.moveTo(50, 240)
           .lineTo(550, 240)
           .stroke();

        // Items
        let y = 260;
        doc.font('Helvetica');
        
        sale.items.forEach(item => {
          doc.text(item.product.name.substring(0, 30), 50, y)
             .text(item.quantity.toString(), 300, y)
             .text(`₹${item.sellingPrice.toFixed(2)}`, 400, y)
             .text(`₹${item.total.toFixed(2)}`, 480, y);
          y += 20;
        });

        // Totals
        y += 20;
        doc.moveTo(350, y - 10)
           .lineTo(550, y - 10)
           .stroke();

        doc.font('Helvetica-Bold')
           .text('Subtotal:', 350, y)
           .text(`₹${sale.subtotal.toFixed(2)}`, 480, y);

        y += 20;
        if (sale.discount > 0) {
          doc.text('Discount:', 350, y)
             .text(`-₹${sale.discount.toFixed(2)}`, 480, y);
          y += 20;
        }

        doc.text('Tax:', 350, y)
           .text(`₹${sale.taxAmount.toFixed(2)}`, 480, y);

        y += 20;
        doc.font('Helvetica-BoldOblique')
           .fontSize(12)
           .text('TOTAL:', 350, y)
           .text(`₹${sale.totalAmount.toFixed(2)}`, 480, y);

        // Payment details
        y += 40;
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Payment Method: ${sale.paymentMethod}`, 50, y);

        // Footer
        const footerY = 700;
        doc.moveTo(50, footerY - 20)
           .lineTo(550, footerY - 20)
           .stroke();

        doc.fontSize(10)
           .text('Thank you for shopping with Frugano!', 50, footerY, {
             align: 'center',
             width: 500
           })
           .text('Visit us again!', 50, footerY + 20, {
             align: 'center',
             width: 500
           });

        // Terms
        doc.fontSize(8)
           .text('This is a computer generated invoice.', 50, footerY + 50, {
             align: 'center',
             width: 500
           });

        doc.end();

        stream.on('finish', () => {
          resolve({
            filename,
            path: filepath,
            url: `/uploads/invoices/${filename}`
          });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async generatePurchaseOrder(purchase) {
    return new Promise((resolve, reject) => {
      try {
        const filename = `po-${purchase.invoiceNo}-${Date.now()}.pdf`;
        const filepath = path.join(this.invoiceDir, filename);
        
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);
        
        doc.pipe(stream);

        // Header
        doc.fontSize(25)
           .font('Helvetica-Bold')
           .text('FRUGANO', 50, 50)
           .fontSize(12)
           .font('Helvetica')
           .text('Purchase Order', 50, 80)
           .moveDown();

        // PO details
        doc.fontSize(10)
           .text(`PO #: ${purchase.invoiceNo}`, 50, 120)
           .text(`Date: ${new Date(purchase.purchaseDate).toLocaleDateString()}`, 50, 135);

        // Supplier details
        if (purchase.supplier) {
          doc.text(`Supplier: ${purchase.supplier.name}`, 300, 120)
             .text(`Phone: ${purchase.supplier.phone}`, 300, 135);
        }

        // Items table (similar to invoice but for purchases)
        // ... implementation similar to invoice

        doc.end();

        stream.on('finish', () => {
          resolve({
            filename,
            path: filepath,
            url: `/uploads/invoices/${filename}`
          });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new InvoiceGenerator();