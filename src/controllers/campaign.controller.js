const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');


// @desc    Get all campaigns
// @route   GET /api/campaigns
// @access  Private
const getCampaigns = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    const take = parseInt(limit);

    const campaigns = await prisma.campaign.findMany({
      skip,
      take,
      include: {
        createdBy: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.campaign.count();

    res.json({
      success: true,
      data: campaigns,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
// @desc    Get single campaign
// @route   GET /api/campaigns/:id
// @access  Private
const getCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { name: true }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Create campaign
// @route   POST /api/campaigns
// @access  Private
const createCampaign = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      type,
      startDate,
      endDate,
      discountType,
      discountValue,
      isActive = true
    } = req.body;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        description,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        discountType,
        discountValue: parseFloat(discountValue),
        isActive,
        createdById: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Update campaign
// @route   PUT /api/campaigns/:id
// @access  Private
const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Delete campaign
// @route   DELETE /api/campaigns/:id
// @access  Private
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.campaign.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Activate campaign
// @route   PATCH /api/campaigns/:id/activate
// @access  Private
const activateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { isActive: true }
    });

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Activate campaign error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Deactivate campaign
// @route   PATCH /api/campaigns/:id/deactivate
// @access  Private
const deactivateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Deactivate campaign error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  activateCampaign,
  deactivateCampaign
};