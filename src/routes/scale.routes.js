const express = require('express');
const router = express.Router();
const scaleService = require('../services/scale.service');
const { authenticate } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Connect to scale
router.post('/connect', authenticate, async (req, res) => {
  try {
    const { scaleId } = req.body;

    let scaleConfig;
    if (scaleId) {
      scaleConfig = await prisma.hardwareConfig.findUnique({
        where: { id: scaleId }
      });
    } else {
      scaleConfig = await prisma.hardwareConfig.findFirst({
        where: {
          deviceType: 'WEIGHING_MACHINE',
          isActive: true
        }
      });
    }

    if (!scaleConfig) {
      return res.status(404).json({ error: 'No scale configured' });
    }

    const result = await scaleService.connect(scaleConfig);

    res.json({
      success: true,
      message: 'Scale connected',
      data: result
    });
  } catch (error) {
    console.error('Scale connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Read weight
router.get('/read', authenticate, async (req, res) => {
  try {
    const weight = await scaleService.readWeight();
    
    // Save measurement
    const measurement = await prisma.weightMeasurement.create({
      data: {
        weight: weight.weight,
        unit: weight.unit,
        stable: weight.stable,
        measuredAt: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        ...weight,
        id: measurement.id
      }
    });
  } catch (error) {
    console.error('Weight read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tare scale
router.post('/tare', authenticate, async (req, res) => {
  try {
    const result = await scaleService.tare();
    res.json({
      success: true,
      message: 'Scale tared',
      data: result
    });
  } catch (error) {
    console.error('Tare error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Zero scale
router.post('/zero', authenticate, async (req, res) => {
  try {
    const result = await scaleService.zero();
    res.json({
      success: true,
      message: 'Scale zeroed',
      data: result
    });
  } catch (error) {
    console.error('Zero error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    scaleService.disconnect();
    res.json({
      success: true,
      message: 'Scale disconnected'
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;