// backend/routes/games.js - Game Management API
const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/games/history
// @desc    Get user's game history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const games = await Game.find({
      'players.userId': req.user.id
    })
    .populate('players.userId', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

    const total = await Game.countDocuments({
      'players.userId': req.user.id
    });

    res.json({
      success: true,
      games,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Error fetching game history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch game history'
    });
  }
});

// @route   GET /api/games/stats
// @desc    Get user's game statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date threshold
    const now = new Date();
    const dateThreshold = new Date();
    
    switch (period) {
      case '7d':
        dateThreshold.setDate(now.getDate() - 7);
        break;
      case '30d':
        dateThreshold.setDate(now.getDate() - 30);
        break;
      case '90d':
        dateThreshold.setDate(now.getDate() - 90);
        break;
      default:
        dateThreshold.setDate(now.getDate() - 30);
    }

    const games = await Game.find({
      'players.userId': req.user.id,
      createdAt: { $gte: dateThreshold }
    });

    const stats = {
      totalGames: games.length,
      gamesWon: games.filter(game => game.winner?.toString() === req.user.id).length,
      averageDuration: games.reduce((sum, game) => sum + (game.duration || 0), 0) / games.length || 0,
      favoriteGameMode: 'casual', // Calculate based on game modes
      pointsWon: 0, // Calculate from games
      pointsLost: 0, // Calculate from games
      currentStreak: req.user.currentStreak,
      longestStreak: req.user.longestStreak
    };

    stats.winRate = stats.totalGames > 0 ? 
      Math.round((stats.gamesWon / stats.totalGames) * 100) : 0;

    res.json({
      success: true,
      stats,
      period
    });

  } catch (error) {
    console.error('Error fetching game stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch game statistics'
    });
  }
});

module.exports = router;