// backend/utils/achievementSystem.js - Complete Achievement System
const User = require('../models/User');

class AchievementSystem {
  static achievements = {
    FIRST_WIN: {
      id: 'first_win',
      name: 'First Victory',
      description: 'Win your first game',
      icon: '🏆',
      points: 50,
      condition: (stats) => stats.gamesWon >= 1
    },
    WINNING_STREAK_3: {
      id: 'streak_3',
      name: 'Hot Streak',
      description: 'Win 3 games in a row',
      icon: '🔥',
      points: 100,
      condition: (stats) => stats.currentStreak >= 3
    },
    WINNING_STREAK_5: {
      id: 'streak_5',
      name: 'Unstoppable',
      description: 'Win 5 games in a row',
      icon: '⚡',
      points: 200,
      condition: (stats) => stats.currentStreak >= 5
    },
    GAMES_PLAYED_10: {
      id: 'veteran_10',
      name: 'Getting Started',
      description: 'Play 10 games',
      icon: '🎮',
      points: 75,
      condition: (stats) => stats.gamesPlayed >= 10
    },
    GAMES_PLAYED_50: {
      id: 'veteran_50',
      name: 'Experienced Player',
      description: 'Play 50 games',
      icon: '🎯',
      points: 150,
      condition: (stats) => stats.gamesPlayed >= 50
    },
    GAMES_PLAYED_100: {
      id: 'veteran_100',
      name: 'Century Club',
      description: 'Play 100 games',
      icon: '💯',
      points: 300,
      condition: (stats) => stats.gamesPlayed >= 100
    },
    HIGH_WIN_RATE: {
      id: 'high_win_rate',
      name: 'Master Player',
      description: 'Maintain 75% win rate over 20+ games',
      icon: '👑',
      points: 500,
      condition: (stats) => stats.gamesPlayed >= 20 && stats.winRate >= 75
    },
    QUICK_GAME: {
      id: 'quick_game',
      name: 'Speed Demon',
      description: 'Win a game in under 2 minutes',
      icon: '⚡',
      points: 100,
      condition: (stats, gameData) => gameData.gameWon && gameData.gameDuration < 120
    },
    TOURNAMENT_WIN: {
      id: 'tournament_winner',
      name: 'Tournament Champion',
      description: 'Win a tournament',
      icon: '🥇',
      points: 1000,
      condition: (stats, gameData) => gameData.tournamentWin
    }
  };

  static async checkAndAwardAchievements(userId, gameData = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];

      const earnedAchievements = user.achievements.map(a => a.name);
      const newAchievements = [];

      // Check each achievement
      for (const [key, achievement] of Object.entries(this.achievements)) {
        if (earnedAchievements.includes(achievement.name)) {
          continue; // Already earned
        }

        const stats = {
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
          winRate: user.winRate,
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak
        };

        if (achievement.condition(stats, gameData)) {
          // Award achievement
          user.achievements.push({
            name: achievement.name,
            description: achievement.description,
            earnedAt: new Date(),
            icon: achievement.icon
          });

          // Award points
          user.points += achievement.points;

          newAchievements.push({
            ...achievement,
            earnedAt: new Date()
          });
        }
      }

      if (newAchievements.length > 0) {
        await user.save();
      }

      return newAchievements;

    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  static async getUserAchievements(userId) {
    try {
      const user = await User.findById(userId).select('achievements');
      return user ? user.achievements : [];
    } catch (error) {
      console.error('Error fetching user achievements:', error);
      return [];
    }
  }

  static getAllAchievements() {
    return Object.values(this.achievements);
  }
}

module.exports = AchievementSystem;