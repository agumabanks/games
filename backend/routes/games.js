const express = require('express');
const Game = require('../models/Game');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/history', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const games = await Game.find({
      'players.userId': req.user.id
    })
    .populate('players.userId', 'username')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

    res.json({
      success: true,
      games
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch game history'
    });
  }
});

router.get('/stats', protect, async (req, res) => {
  try {
    const stats = {
      totalGames: req.user.gamesPlayed,
      gamesWon: req.user.gamesWon,
      winRate: req.user.winRate,
      points: req.user.points,
      level: req.user.level
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch game statistics'
    });
  }
});

module.exports = router;
