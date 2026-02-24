const QRCode = require('qrcode');

class UPIService {
  constructor() {
    // Default UPI ID for the store (configure this in .env)
    this.upiId = process.env.UPI_ID || 'store@frugano';
    this.merchantName = process.env.MERCHANT_NAME || 'Frugano Store';
    this.merchantCode = process.env.MERCHANT_CODE || 'FRUGANO';
  }

  /**
   * Generate UPI payment link
   * Format: upi://pay?pa=upiid@bank&pn=MerchantName&am=amount&cu=INR
   */
  generateUPILink(amount, orderId, customerName = '') {
    const params = new URLSearchParams({
      pa: this.upiId,                    // Payee address (UPI ID)
      pn: this.merchantName,              // Payee name
      am: amount.toFixed(2),              // Amount
      cu: 'INR',                          // Currency
      tn: `Order ${orderId}`,              // Transaction note
      mc: this.merchantCode,               // Merchant code
    });

    // Add customer name if provided
    if (customerName) {
      params.append('pn', customerName);
    }

    return `upi://pay?${params.toString()}`;
  }

  /**
   * Generate QR Code as Data URL
   */
  async generateQRCode(amount, orderId, customerName = '') {
    try {
      const upiLink = this.generateUPILink(amount, orderId, customerName);
      
      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(upiLink, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: {
          dark: '#1B4D3E', // Primary color
          light: '#FFFFFF'
        }
      });

      return {
        upiLink,
        qrCode: qrCodeDataURL,
        amount,
        orderId,
        upiId: this.upiId
      };
    } catch (error) {
      console.error('QR Code generation error:', error);
      throw error;
    }
  }

  /**
   * Generate QR Code as Buffer (for printing)
   */
  async generateQRCodeBuffer(amount, orderId, customerName = '') {
    try {
      const upiLink = this.generateUPILink(amount, orderId, customerName);
      
      const buffer = await QRCode.toBuffer(upiLink, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return buffer;
    } catch (error) {
      console.error('QR Code buffer generation error:', error);
      throw error;
    }
  }

  /**
   * Generate QR Code for thermal printer (ESC/POS format)
   */
  generateQRCodeForPrinter(amount, orderId) {
    const upiLink = this.generateUPILink(amount, orderId);
    
    // ESC/POS QR code commands
    // GS ( k <pL> <pH> cn fn <m> <n> <d1>...<dk>
    const model = 49; // Model 1 (49) or Model 2 (50)
    const moduleSize = 8; // Size of QR module (1-16)
    const errorCorrection = 48; // 48=L, 49=M, 50=Q, 51=H
    
    // Convert string to byte array
    const data = Buffer.from(upiLink, 'ascii');
    
    // Calculate sizes
    const dataLength = data.length + 3;
    const pL = dataLength % 256;
    const pH = Math.floor(dataLength / 256);
    
    // Build command
    const qrCode = Buffer.concat([
      Buffer.from([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]), // Function 165: Store QR code data
      data,
      Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x52, model]), // Function 167: Set module size
      Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, errorCorrection]), // Function 169: Set error correction
      Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]), // Function 180: Print QR code
    ]);

    return qrCode;
  }

  /**
   * Parse UPI payment response (webhook)
   */
  parsePaymentResponse(data) {
    // This would handle webhook callbacks from payment gateway
    // For now, return mock response
    return {
      success: true,
      transactionId: `TXN${Date.now()}`,
      amount: data.amount,
      orderId: data.orderId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verify payment (mock)
   */
  async verifyPayment(transactionId, amount) {
    // In production, this would call your payment gateway API
    return {
      success: true,
      verified: true,
      transactionId,
      amount
    };
  }
}

module.exports = new UPIService();