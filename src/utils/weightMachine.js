// backend/src/utils/weightMachine.js
const { PrismaClient } = require('@prisma/client');
const EventEmitter = require('events');

class WeightMachineService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.isConnected = false;
  }

  async connect() {
    try {
      // For development: mock connection
      this.isConnected = true;
      console.log('✅ Weight machine connected (mock mode)');
      
      // Simulate weight readings
      this.startMockReadings();
      
      return true;
    } catch (error) {
      console.error('Failed to connect to weight machine:', error);
      return false;
    }
  }

  startMockReadings() {
    // For development: emit random weights
    setInterval(() => {
      if (this.isConnected) {
        const mockWeight = Math.random() * 5; // 0-5 kg
        this.emit('weight', {
          weight: mockWeight,
          unit: 'kg',
          stable: Math.random() > 0.3,
          timestamp: new Date()
        });
      }
    }, 2000);
  }

  async getWeight() {
    // In production, read from serial port
    return new Promise((resolve) => {
      this.once('weight', resolve);
    });
  }

  disconnect() {
    this.isConnected = false;
    console.log('Weight machine disconnected');
  }
}

module.exports = WeightMachineService;