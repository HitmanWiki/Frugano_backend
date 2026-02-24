const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const ModbusRTU = require('modbus-serial');

class ScaleService {
  constructor() {
    this.port = null;
    this.parser = null;
    this.modbusClient = null;
    this.isConnected = false;
    this.isVercel = process.env.VERCEL === '1';
  }

  // Connect to weighing scale
  async connect(config) {
    if (this.isVercel) {
      console.log('⚖️ Scale disabled on Vercel (use local connection instead)');
      return this.mockConnect();
    }

    try {
      switch (config.connectionType) {
        case 'SERIAL':
          // Serial/COM port connection
          this.port = new SerialPort(config.comPort, {
            baudRate: config.baudRate || 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
          });

          this.parser = this.port.pipe(new Readline({ delimiter: '\r\n' }));

          this.port.on('open', () => {
            console.log(`✅ Scale connected on ${config.comPort}`);
            this.isConnected = true;
          });

          this.port.on('error', (error) => {
            console.error('❌ Scale error:', error);
            this.isConnected = false;
          });

          // Setup data parser based on scale model
          this.setupParser(config);
          break;

        case 'USB':
          // USB HID scale
          // This would need specific USB HID implementation
          console.log('USB scale support coming soon');
          break;

        case 'BLUETOOTH':
          // Bluetooth scale
          console.log('Bluetooth scale support coming soon');
          break;

        default:
          throw new Error('Unsupported scale connection type');
      }

      return { success: true, connected: this.isConnected };
    } catch (error) {
      console.error('❌ Scale connection failed:', error);
      throw error;
    }
  }

  // Setup parser based on scale model
  setupParser(config) {
    if (!this.parser) return;

    switch (config.model) {
      case 'CAS_DBII':
        // CAS DB-II scale format
        this.parser.on('data', (data) => {
          const weight = this.parseCASData(data);
          if (weight) {
            this.emit('weight', weight);
          }
        });
        break;

      default:
        // Generic scale - assume simple numeric output
        this.parser.on('data', (data) => {
          const weight = parseFloat(data);
          if (!isNaN(weight)) {
            this.emit('weight', { weight, unit: 'kg', stable: true });
          }
        });
    }
  }

  // Parse CAS DB-II scale data
  parseCASData(data) {
    // CAS DB-II format example: "   1.234 kg   S"
    const match = data.match(/\s*([0-9.]+)\s*(\w+)\s*([SU]?)/);
    if (match) {
      return {
        weight: parseFloat(match[1]),
        unit: match[2],
        stable: match[3] === 'S'
      };
    }
    return null;
  }

  // Read current weight
  async readWeight() {
    if (this.isVercel) {
      return this.mockReadWeight();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Weight read timeout'));
      }, 5000);

      const handler = (weight) => {
        clearTimeout(timeout);
        this.parser.removeListener('data', handler);
        resolve(weight);
      };

      this.parser.once('data', handler);
    });
  }

  // Continuous weight reading
  startContinuousReading(callback) {
    if (this.isVercel) {
      // Mock continuous reading
      return setInterval(() => {
        callback(this.mockReadWeight());
      }, 1000);
    }

    const handler = (data) => {
      const weight = this.parseCASData(data);
      if (weight) {
        callback(weight);
      }
    };

    this.parser.on('data', handler);
    return handler;
  }

  stopContinuousReading(handler) {
    if (this.parser) {
      this.parser.removeListener('data', handler);
    }
  }

  // Tare scale
  async tare() {
    if (this.isVercel) {
      return { success: true, message: 'Tare successful (mock)' };
    }

    // Send tare command (varies by scale model)
    if (this.port) {
      this.port.write('T\r\n'); // Common tare command
      return { success: true };
    }
    throw new Error('Scale not connected');
  }

  // Zero scale
  async zero() {
    if (this.isVercel) {
      return { success: true, message: 'Zero successful (mock)' };
    }

    if (this.port) {
      this.port.write('Z\r\n'); // Common zero command
      return { success: true };
    }
    throw new Error('Scale not connected');
  }

  // Disconnect
  disconnect() {
    if (this.port) {
      this.port.close();
      this.isConnected = false;
    }
  }

  // Mock methods for Vercel/development
  mockConnect() {
    console.log('⚖️ Using mock scale connection');
    this.isConnected = true;
    return { success: true, connected: true, mock: true };
  }

  mockReadWeight() {
    // Generate random weight between 0 and 5 kg
    const weight = (Math.random() * 5).toFixed(2);
    const stable = Math.random() > 0.3;
    
    return {
      weight: parseFloat(weight),
      unit: 'kg',
      stable,
      timestamp: new Date(),
      mock: true
    };
  }

  // Event emitter
  emit(event, data) {
    // This would be integrated with your app's event system
    console.log(`📢 Scale event: ${event}`, data);
  }
}

module.exports = new ScaleService();