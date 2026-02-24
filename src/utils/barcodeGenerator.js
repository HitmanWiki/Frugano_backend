const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

class BarcodeGenerator {
  constructor() {
    this.barcodeDir = path.join(__dirname, '../../uploads/barcodes');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(this.barcodeDir)) {
      fs.mkdirSync(this.barcodeDir, { recursive: true });
    }
  }

  // Generate EAN-13 barcode
  async generateEAN13(code) {
    try {
      // Validate code length
      if (code.length !== 12 && code.length !== 13) {
        throw new Error('EAN-13 requires 12 or 13 digits');
      }

      // Calculate checksum if not provided
      if (code.length === 12) {
        code += this.calculateEAN13Checksum(code);
      }

      // Create barcode image
      const width = 300;
      const height = 150;
      const image = new Jimp(width, height, 0xffffffff);

      // Draw barcode lines
      const encoding = this.encodeEAN13(code);
      const xStart = 20;
      let x = xStart;

      for (let i = 0; i < encoding.length; i++) {
        const width = encoding[i] === '1' ? 2 : 1;
        
        for (let w = 0; w < width; w++) {
          if (encoding[i] === '1') {
            for (let y = 20; y < height - 20; y++) {
              image.setPixelColor(0xff000000, x, y);
            }
          }
          x++;
        }
      }

      // Save image
      const filename = `barcode-${code}-${Date.now()}.png`;
      const filepath = path.join(this.barcodeDir, filename);
      await image.writeAsync(filepath);

      return {
        filename,
        path: filepath,
        url: `/uploads/barcodes/${filename}`,
        code
      };
    } catch (error) {
      console.error('Barcode generation error:', error);
      throw error;
    }
  }

  // Generate QR code
  async generateQRCode(data) {
    try {
      const QRCode = require('qrcode');
      const filename = `qrcode-${Date.now()}.png`;
      const filepath = path.join(this.barcodeDir, filename);

      await QRCode.toFile(filepath, data, {
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      return {
        filename,
        path: filepath,
        url: `/uploads/barcodes/${filename}`,
        data
      };
    } catch (error) {
      console.error('QR code generation error:', error);
      throw error;
    }
  }

  // Generate product label
  async generateProductLabel(product) {
    try {
      const width = 400;
      const height = 300;
      const image = new Jimp(width, height, 0xffffffff);

      // Add product name
      // This would require adding text to image
      // For now, generate QR code with product info
      
      const productInfo = JSON.stringify({
        id: product.id,
        name: product.name,
        price: product.sellingPrice,
        sku: product.sku
      });

      return this.generateQRCode(productInfo);
    } catch (error) {
      console.error('Product label error:', error);
      throw error;
    }
  }

  // Calculate EAN-13 checksum
  calculateEAN13Checksum(code) {
    let sum = 0;
    
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }

    const checksum = (10 - (sum % 10)) % 10;
    return checksum.toString();
  }

  // Encode EAN-13 (simplified)
  encodeEAN13(code) {
    // This is a simplified encoding
    // Real implementation would use proper EAN-13 encoding tables
    let encoding = '101'; // Start
    
    for (let i = 0; i < code.length; i++) {
      const digit = parseInt(code[i]);
      encoding += this.encodeDigit(digit, i);
    }
    
    encoding += '101'; // End
    
    return encoding;
  }

  encodeDigit(digit, position) {
    // Simplified encoding - L-code for first 6 digits, R-code for last 6
    const L_CODES = [
      '0001101', '0011001', '0010011', '0111101', '0100011',
      '0110001', '0101111', '0111011', '0110111', '0001011'
    ];
    
    const R_CODES = [
      '1110010', '1100110', '1101100', '1000010', '1011100',
      '1001110', '1010000', '1000100', '1001000', '1110100'
    ];

    if (position < 6) {
      return L_CODES[digit];
    } else {
      return R_CODES[digit];
    }
  }
}

module.exports = new BarcodeGenerator();