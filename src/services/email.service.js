const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail(options) {
    try {
      const mailOptions = {
        from: `"Frugano" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments || []
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  }

  async sendInvoiceEmail(to, invoiceData, pdfBuffer) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1B4D3E; color: white; padding: 20px; text-align: center;">
          <h1>FRUGANO</h1>
          <p>Freshness Delivered Daily</p>
        </div>
        
        <div style="padding: 20px;">
          <h2>Invoice #${invoiceData.invoiceNo}</h2>
          <p>Dear ${invoiceData.customerName || 'Customer'},</p>
          <p>Thank you for shopping with Frugano. Your invoice is attached to this email.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Order Summary</h3>
            <p><strong>Date:</strong> ${new Date(invoiceData.date).toLocaleDateString()}</p>
            <p><strong>Total Amount:</strong> ₹${invoiceData.totalAmount}</p>
            <p><strong>Payment Method:</strong> ${invoiceData.paymentMethod}</p>
          </div>
          
          <p>If you have any questions, please contact us at support@frugano.com</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
            <p>Thank you for choosing Frugano!</p>
            <p>© 2024 Frugano. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: `Invoice #${invoiceData.invoiceNo} from Frugano`,
      html,
      attachments: [
        {
          filename: `invoice-${invoiceData.invoiceNo}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
  }

  async sendWelcomeEmail(to, name) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1B4D3E; color: white; padding: 20px; text-align: center;">
          <h1>Welcome to Frugano!</h1>
        </div>
        
        <div style="padding: 20px;">
          <h2>Hello ${name},</h2>
          <p>Thank you for joining Frugano! We're excited to have you as a member of our community.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Your Benefits:</h3>
            <ul>
              <li>Fresh fruits & vegetables delivered daily</li>
              <li>Exclusive member discounts</li>
              <li>Loyalty points on every purchase</li>
              <li>Early access to seasonal offers</li>
            </ul>
          </div>
          
          <p>Start shopping now and enjoy the freshest produce!</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/shop" style="background-color: #1B4D3E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Start Shopping</a>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'Welcome to Frugano!',
      html
    });
  }

  async sendLowStockAlert(to, products) {
    const productList = products.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${p.currentStock} ${p.unit}</td>
        <td style="color: #FF4F4F;">${p.minStockAlert} ${p.unit}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FF4F4F; color: white; padding: 20px; text-align: center;">
          <h2>⚠️ Low Stock Alert</h2>
        </div>
        
        <div style="padding: 20px;">
          <p>The following products are running low on stock:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: left;">Current Stock</th>
                <th style="padding: 10px; text-align: left;">Min Level</th>
              </tr>
            </thead>
            <tbody>
              ${productList}
            </tbody>
          </table>
          
          <p>Please reorder soon to avoid stockouts.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/inventory" style="background-color: #1B4D3E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">View Inventory</a>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: '⚠️ Low Stock Alert - Frugano',
      html
    });
  }
}

module.exports = new EmailService();