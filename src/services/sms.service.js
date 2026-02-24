const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  async sendSMS(to, message) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });
      
      console.log('SMS sent:', result.sid);
      return result;
    } catch (error) {
      console.error('SMS send error:', error);
      throw error;
    }
  }

  async sendOrderConfirmation(phone, orderDetails) {
    const message = `
      FRUGANO: Order Confirmed!
      Order #${orderDetails.orderNumber}
      Total: ₹${orderDetails.totalAmount}
      Expected Delivery: ${orderDetails.deliveryDate}
      
      Track your order: ${process.env.FRONTEND_URL}/track/${orderDetails.trackingId}
    `;

    return this.sendSMS(phone, message);
  }

  async sendOTP(phone, otp) {
    const message = `
      FRUGANO: Your verification code is ${otp}
      This code will expire in 10 minutes.
      
      Do not share this code with anyone.
    `;

    return this.sendSMS(phone, message);
  }

  async sendDeliveryUpdate(phone, orderDetails) {
    const message = `
      FRUGANO: Delivery Update
      Order #${orderDetails.orderNumber}
      Status: ${orderDetails.status}
      
      Your delivery partner: ${orderDetails.deliveryBoy}
      Contact: ${orderDetails.deliveryBoyPhone}
    `;

    return this.sendSMS(phone, message);
  }

  async sendPaymentReminder(phone, amount, dueDate) {
    const message = `
      FRUGANO: Payment Reminder
      Amount Due: ₹${amount}
      Due Date: ${dueDate}
      
      Please make payment to avoid late fees.
      Pay now: ${process.env.FRONTEND_URL}/payments
    `;

    return this.sendSMS(phone, message);
  }
}

module.exports = new SMSService();