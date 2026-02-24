const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const escpos = require('escpos');
const path = require('path');
const fs = require('fs');

class PrinterService {
  constructor() {
    this.printer = null;
    this.isVercel = process.env.VERCEL === '1';
  }

  // Initialize printer based on configuration
  async initPrinter(config) {
    if (this.isVercel) {
      console.log('📋 Printer disabled on Vercel (use local network printer instead)');
      return null;
    }

    try {
      switch (config.connectionType) {
        case 'USB':
          // USB Printer
          const device = new escpos.USB(config.vendorId, config.productId);
          const options = { encoding: "GB18030" };
          this.printer = new escpos.Printer(device, options);
          break;

        case 'NETWORK':
          // Network Printer (Ethernet/WiFi)
          this.printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: `tcp://${config.ipAddress}:${config.port || 9100}`,
            width: 42, // Character width
            characterSet: 'SLOVENIA',
            removeSpecialCharacters: false,
            lineChar: "=",
          });
          break;

        case 'SERIAL':
          // Serial/COM Port
          this.printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: config.comPort,
            width: 42,
            characterSet: 'SLOVENIA',
            removeSpecialCharacters: false,
            lineChar: "=",
          });
          break;

        default:
          throw new Error('Unsupported printer connection type');
      }

      // Test connection
      const isConnected = await this.printer.isPrinterAlive();
      if (!isConnected) {
        throw new Error('Printer not responding');
      }

      console.log('✅ Printer initialized successfully');
      return this.printer;
    } catch (error) {
      console.error('❌ Printer initialization failed:', error);
      throw error;
    }
  }

  // Print invoice
  async printInvoice(saleData, printerConfig) {
    try {
      if (this.isVercel) {
        // On Vercel, generate PDF instead of printing directly
        return await this.generatePDFInvoice(saleData);
      }

      await this.initPrinter(printerConfig);

      // Format receipt
      const receipt = this.formatReceipt(saleData);

      // Print using node-thermal-printer
      if (this.printer instanceof ThermalPrinter) {
        this.printer.alignCenter();
        this.printer.println('FRUGANO');
        this.printer.println('Freshness Delivered Daily');
        this.printer.drawLine();
        
        this.printer.alignLeft();
        this.printer.println(`Invoice: ${saleData.invoiceNo}`);
        this.printer.println(`Date: ${new Date(saleData.saleDate).toLocaleString()}`);
        this.printer.println(`Cashier: ${saleData.cashier?.name || 'Unknown'}`);
        if (saleData.customerName) {
          this.printer.println(`Customer: ${saleData.customerName}`);
        }
        this.printer.drawLine();

        // Items
        saleData.items.forEach(item => {
          const name = item.product?.name.substring(0, 20).padEnd(20);
          const qty = item.quantity.toFixed(2).padStart(6);
          const price = item.sellingPrice.toFixed(2).padStart(8);
          const total = (item.quantity * item.sellingPrice).toFixed(2).padStart(8);
          this.printer.println(`${name} ${qty} @ ${price} = ${total}`);
        });

        this.printer.drawLine();
        this.printer.println(`Subtotal: ${saleData.subtotal.toFixed(2).padStart(28)}`);
        if (saleData.discount > 0) {
          this.printer.println(`Discount: -${saleData.discount.toFixed(2).padStart(27)}`);
        }
        this.printer.println(`Tax: ${saleData.taxAmount.toFixed(2).padStart(32)}`);
        this.printer.println(`TOTAL: ${saleData.totalAmount.toFixed(2).padStart(30)}`);
        this.printer.drawLine();

        this.printer.println(`Payment: ${saleData.paymentMethod}`);
        this.printer.drawLine();
        
        this.printer.alignCenter();
        this.printer.println('Thank you for shopping!');
        this.printer.println('Visit us again!');
        
        // Cut paper
        this.printer.cut();

        // Execute print
        return await this.printer.execute();
      }

      // Print using escpos (USB)
      if (this.printer instanceof escpos.Printer) {
        return new Promise((resolve, reject) => {
          this.printer.device.open((error) => {
            if (error) {
              reject(error);
              return;
            }

            this.printer
              .font('a')
              .align('ct')
              .style('bu')
              .size(1, 1)
              .text('FRUGANO')
              .text('Freshness Delivered Daily')
              .text('----------------------')
              .align('lt')
              .text(`Invoice: ${saleData.invoiceNo}`)
              .text(`Date: ${new Date(saleData.saleDate).toLocaleString()}`)
              .text(`Cashier: ${saleData.cashier?.name || 'Unknown'}`)
              .text('----------------------')
              .table(['Item', 'Qty', 'Price'])
              .text('----------------------');

            saleData.items.forEach(item => {
              this.printer.text(
                `${item.product?.name.substring(0, 20)} ${item.quantity} x ${item.sellingPrice}`
              );
            });

            this.printer
              .text('----------------------')
              .text(`Subtotal: ${saleData.subtotal.toFixed(2)}`)
              .text(`Tax: ${saleData.taxAmount.toFixed(2)}`)
              .text(`TOTAL: ${saleData.totalAmount.toFixed(2)}`)
              .text('----------------------')
              .text(`Payment: ${saleData.paymentMethod}`)
              .text('----------------------')
              .text('Thank you for shopping!')
              .cut()
              .close();

            resolve({ success: true });
          });
        });
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Print failed:', error);
      throw error;
    }
  }

  // Generate PDF invoice (fallback for Vercel)
  async generatePDFInvoice(saleData) {
    const PDFDocument = require('pdfkit');
    const invoiceDir = path.join(__dirname, '../../uploads/invoices');
    
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    const filename = `invoice-${saleData.invoiceNo}-${Date.now()}.pdf`;
    const filepath = path.join(invoiceDir, filename);
    
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    
    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('FRUGANO', { align: 'center' });
    doc.fontSize(12).text('Freshness Delivered Daily', { align: 'center' });
    doc.moveDown();
    doc.text('='.repeat(50), { align: 'center' });
    doc.moveDown();

    // Invoice details
    doc.fontSize(10);
    doc.text(`Invoice: ${saleData.invoiceNo}`);
    doc.text(`Date: ${new Date(saleData.saleDate).toLocaleString()}`);
    doc.text(`Cashier: ${saleData.cashier?.name || 'Unknown'}`);
    if (saleData.customerName) {
      doc.text(`Customer: ${saleData.customerName}`);
    }
    doc.moveDown();
    doc.text('='.repeat(50), { align: 'center' });
    doc.moveDown();

    // Items
    saleData.items.forEach(item => {
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
    doc.text(`Subtotal: ₹${saleData.subtotal.toFixed(2)}`, { align: 'right' });
    if (saleData.discount > 0) {
      doc.text(`Discount: -₹${saleData.discount.toFixed(2)}`, { align: 'right' });
    }
    doc.text(`Tax: ₹${saleData.taxAmount.toFixed(2)}`, { align: 'right' });
    doc.fontSize(12).text(`TOTAL: ₹${saleData.totalAmount.toFixed(2)}`, { align: 'right' });
    doc.moveDown();
    doc.text('='.repeat(50), { align: 'center' });
    doc.moveDown();

    doc.text(`Payment: ${saleData.paymentMethod}`, { align: 'center' });
    doc.moveDown();
    doc.text('Thank you for shopping with Frugano!', { align: 'center' });

    doc.end();

    return new Promise((resolve) => {
      stream.on('finish', () => {
        resolve({
          filename,
          path: filepath,
          url: `/uploads/invoices/${filename}`
        });
      });
    });
  }

  // Format receipt
  formatReceipt(saleData) {
    const lines = [];
    
    // Header
    lines.push('='.repeat(40));
    lines.push('           FRUGANO');
    lines.push('    Freshness Delivered Daily');
    lines.push('='.repeat(40));
    
    // Invoice details
    lines.push(`Invoice: ${saleData.invoiceNo}`);
    lines.push(`Date: ${new Date(saleData.saleDate).toLocaleString()}`);
    lines.push(`Cashier: ${saleData.cashier?.name || 'Unknown'}`);
    if (saleData.customerName) {
      lines.push(`Customer: ${saleData.customerName}`);
    }
    lines.push('='.repeat(40));
    
    // Items
    lines.push('Item               Qty    Price');
    lines.push('-'.repeat(40));
    
    saleData.items.forEach(item => {
      const name = item.product?.name.substring(0, 15).padEnd(15);
      const qty = item.quantity.toFixed(2).padStart(6);
      const price = item.total.toFixed(2).padStart(8);
      lines.push(`${name} ${qty} ${price}`);
    });
    
    lines.push('-'.repeat(40));
    
    // Totals
    lines.push(`Subtotal:${saleData.subtotal.toFixed(2).padStart(28)}`);
    if (saleData.discount > 0) {
      lines.push(`Discount:${saleData.discount.toFixed(2).padStart(27)}`);
    }
    lines.push(`Tax:${saleData.taxAmount.toFixed(2).padStart(32)}`);
    lines.push(`TOTAL:${saleData.totalAmount.toFixed(2).padStart(30)}`);
    lines.push('='.repeat(40));
    
    // Payment
    lines.push(`Payment: ${saleData.paymentMethod}`);
    lines.push('='.repeat(40));
    
    // Footer
    lines.push('    Thank you for shopping!');
    lines.push('    Visit us again!');
    lines.push('='.repeat(40));
    
    return lines.join('\n');
  }

  // Test printer
  async testPrinter(config) {
    try {
      await this.initPrinter(config);
      
      const testPage = `
        ========================================
                    FRUGANO
              Printer Test Page
        ========================================
        
        If you can read this,
        your thermal printer is working!
        
        Date: ${new Date().toLocaleString()}
        
        ========================================
        Thank you for using Frugano!
        ========================================
      `;

      if (this.printer instanceof ThermalPrinter) {
        this.printer.println(testPage);
        this.printer.cut();
        return await this.printer.execute();
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Printer test failed:', error);
      throw error;
    }
  }
}

module.exports = new PrinterService();