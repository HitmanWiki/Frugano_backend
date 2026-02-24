class WhatsAppService {
  constructor() {
    // Initialize WhatsApp Business API client
    this.apiUrl = 'https://graph.facebook.com/v17.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  }

  async sendMessage(to, message) {
    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message }
        })
      });

      const data = await response.json();
      console.log('WhatsApp message sent:', data);
      return data;
    } catch (error) {
      console.error('WhatsApp send error:', error);
      throw error;
    }
  }

  async sendTemplate(to, templateName, components = []) {
    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: components
          }
        })
      });

      const data = await response.json();
      console.log('WhatsApp template sent:', data);
      return data;
    } catch (error) {
      console.error('WhatsApp template error:', error);
      throw error;
    }
  }

  async sendOrderConfirmation(to, orderDetails) {
    return this.sendTemplate(to, 'order_confirmation', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: orderDetails.orderNumber },
          { type: 'text', text: `₹${orderDetails.totalAmount}` },
          { type: 'text', text: orderDetails.deliveryDate }
        ]
      }
    ]);
  }

  async sendInvoice(to, invoiceData, pdfUrl) {
    // Send invoice as document
    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'document',
          document: {
            link: pdfUrl,
            filename: `invoice-${invoiceData.invoiceNo}.pdf`,
            caption: `Your invoice #${invoiceData.invoiceNo} from Frugano`
          }
        })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('WhatsApp document error:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppService();