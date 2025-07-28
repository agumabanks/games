// backend/utils/analytics.js - Complete Analytics System
const User = require('../models/User');
const Game = require('../models/Game');

class GameAnalytics {
  static async getPlayerPerformance(userId, period = '30d') {
    try {
      const dateThreshold = this.getPeriodDate(period);
      
      const games = await Game.find({
        'players.userId': userId,
        createdAt: { $gte: dateThreshold }
      });

      const performance = {
        totalGames: games.length,
        wins: games.filter(game => game.winner?.toString() === userId).length,
        avgDuration: games.reduce((sum, game) => sum + (game.duration || 0), 0) / games.length || 0,
        preferredGameModes: this.calculateGameModePreference(games),
        peakPlayingHours: this.calculatePeakHours(games),
        performanceTrend: this.calculateTrend(games)
      };

      performance.winRate = performance.totalGames > 0 ? 
        Math.round((performance.wins / performance.totalGames) * 100) : 0;

      return performance;

    } catch (error) {
      console.error('Error analyzing player performance:', error);
      return null;
    }
  }

  static async getGameModeStats(userId, period = '30d') {
    try {
      const dateThreshold = this.getPeriodDate(period);
      
      const games = await Game.aggregate([
        {
          $match: {
            'players.userId': userId,
            createdAt: { $gte: dateThreshold }
          }
        },
        {
          $group: {
            _id: '$gameMode',
            count: { $sum: 1 },
            wins: {
              $sum: {
                $cond: [
                  { $eq: ['$winner', userId] },
                  1,
                  0
                ]
              }
            },
            avgDuration: { $avg: '$duration' }
          }
        }
      ]);

      return games.map(mode => ({
        gameMode: mode._id,
        gamesPlayed: mode.count,
        wins: mode.wins,
        winRate: Math.round((mode.wins / mode.count) * 100),
        avgDuration: Math.round(mode.avgDuration || 0)
      }));

    } catch (error) {
      console.error('Error analyzing game mode stats:', error);
      return [];
    }
  }

  static async getPerformanceTrend(userId, period = '30d') {
    try {
      const dateThreshold = this.getPeriodDate(period);
      const days = this.getDaysBetween(dateThreshold, new Date());
      
      const games = await Game.find({
        'players.userId': userId,
        createdAt: { $gte: dateThreshold }
      }).sort({ createdAt: 1 });

      const trend = [];
      
      for (let i = 0; i < days; i++) {
        const date = new Date(dateThreshold);
        date.setDate(dateThreshold.getDate() + i);
        
        const dayGames = games.filter(game => {
          const gameDate = new Date(game.createdAt);
          return gameDate.toDateString() === date.toDateString();
        });

        const dayWins = dayGames.filter(game => 
          game.winner?.toString() === userId
        ).length;

        trend.push({
          date: date.toISOString().split('T')[0],
          games: dayGames.length,
          wins: dayWins,
          winRate: dayGames.length > 0 ? 
            Math.round((dayWins / dayGames.length) * 100) : 0
        });
      }

      return trend;

    } catch (error) {
      console.error('Error calculating performance trend:', error);
      return [];
    }
  }

  static calculateGameModePreference(games) {
    const modes = {};
    games.forEach(game => {
      const mode = game.gameMode || 'casual';
      modes[mode] = (modes[mode] || 0) + 1;
    });

    return Object.entries(modes)
      .sort(([,a], [,b]) => b - a)
      .map(([mode, count]) => ({ mode, count }));
  }

  static calculatePeakHours(games) {
    const hours = new Array(24).fill(0);
    
    games.forEach(game => {
      const hour = new Date(game.createdAt).getHours();
      hours[hour]++;
    });

    const peakHour = hours.indexOf(Math.max(...hours));
    return {
      peakHour,
      distribution: hours
    };
  }

  static calculateTrend(games) {
    if (games.length < 10) return 'insufficient_data';
    
    const recentGames = games.slice(-10);
    const olderGames = games.slice(0, Math.min(10, games.length - 10));
    
    const recentWinRate = recentGames.filter(game => 
      game.winner?.toString() === games[0].players[0].userId
    ).length / recentGames.length;
    
    const olderWinRate = olderGames.filter(game => 
      game.winner?.toString() === games[0].players[0].userId
    ).length / olderGames.length;

    const difference = recentWinRate - olderWinRate;
    
    if (difference > 0.1) return 'improving';
    if (difference < -0.1) return 'declining';
    return 'stable';
  }

  static getPeriodDate(period) {
    const now = new Date();
    const date = new Date();
    
    switch (period) {
      case '7d':
        date.setDate(now.getDate() - 7);
        break;
      case '30d':
        date.setDate(now.getDate() - 30);
        break;
      case '90d':
        date.setDate(now.getDate() - 90);
        break;
      case '1y':
        date.setFullYear(now.getFullYear() - 1);
        break;
      default:
        date.setDate(now.getDate() - 30);
    }
    
    return date;
  }

  static getDaysBetween(start, end) {
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  static async getLeaderboard(period = '30d', limit = 20) {
    try {
      const dateThreshold = this.getPeriodDate(period);
      
      const leaderboard = await User.aggregate([
        {
          $lookup: {
            from: 'games',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ['$$userId', '$players.userId'] },
                      { $gte: ['$createdAt', dateThreshold] }
                    ]
                  }
                }
              }
            ],
            as: 'recentGames'
          }
        },
        {
          $addFields: {
            recentGamesCount: { $size: '$recentGames' },
            recentWins: {
              $size: {
                $filter: {
                  input: '$recentGames',
                  cond: { $eq: ['$$this.winner', '$_id'] }
                }
              }
            }
          }
        },
        {
          $match: {
            recentGamesCount: { $gte: 5 } // At least 5 games to qualify
          }
        },
        {
          $addFields: {
            recentWinRate: {
              $multiply: [
                { $divide: ['$recentWins', '$recentGamesCount'] },
                100
              ]
            }
          }
        },
        {
          $sort: { recentWinRate: -1, points: -1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            username: 1,
            points: 1,
            level: 1,
            avatar: 1,
            country: 1,
            recentGamesCount: 1,
            recentWins: 1,
            recentWinRate: 1
          }
        }
      ]);

      return leaderboard.map((user, index) => ({
        rank: index + 1,
        ...user,
        recentWinRate: Math.round(user.recentWinRate)
      }));

    } catch (error) {
      console.error('Error generating leaderboard:', error);
      return [];
    }
  }
}

module.exports = GameAnalytics;