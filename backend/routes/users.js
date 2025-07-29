const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const users = await User.find({})
      .select('username points level gamesWon gamesPlayed winRate')
      .sort({ points: -1, winRate: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      leaderboard: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
});

module.exports = router;
