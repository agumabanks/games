const express = require('express');
const Tournament = require('../models/Tournament');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const tournaments = await Tournament.find({})
      .populate('participants.userId', 'username level')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      tournaments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tournaments'
    });
  }
});

module.exports = router;
