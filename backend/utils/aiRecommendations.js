// backend/utils/aiRecommendations.js - AI Recommendation Engine
class AIRecommendationEngine {
  static async getPersonalizedRecommendations(userId) {
    try {
      const user = await User.findById(userId);
      const gameHistory = await Game.find({ 'players.userId': userId })
        .limit(50)
        .sort({ createdAt: -1 });

      const recommendations = [];

      // Skill-based recommendations
      if (user.winRate > 75 && user.gamesPlayed > 20) {
        recommendations.push({
          type: 'tournament',
          title: 'Join Advanced Tournament',
          description: 'Your win rate qualifies you for premium tournaments',
          priority: 'high',
          action: 'join_tournament'
        });
      }

      // Time-based recommendations
      const playingHours = this.analyzePlayingHours(gameHistory);
      if (playingHours.mostActive && this.isCurrentlyActiveTime(playingHours.mostActive)) {
        recommendations.push({
          type: 'quick_match',
          title: 'Peak Playing Time!',
          description: 'More players are online now',
          priority: 'medium',
          action: 'quick_match'
        });
      }

      // Social recommendations
      const friendActivity = await this.analyzeFriendActivity(userId);
      if (friendActivity.onlineFriends > 0) {
        recommendations.push({
          type: 'social',
          title: 'Friends Online',
          description: `${friendActivity.onlineFriends} friends are playing now`,
          priority: 'medium',
          action: 'invite_friends'
        });
      }

      // Shopping recommendations
      if (user.points > 1000) {
        const suitableProducts = await this.getAffordableProducts(user.points);
        if (suitableProducts.length > 0) {
          recommendations.push({
            type: 'shopping',
            title: 'Redeem Your Points',
            description: `${suitableProducts.length} items available for your points`,
            priority: 'low',
            action: 'visit_shop'
          });
        }
      }

      return recommendations;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  static analyzePlayingHours(games) {
    const hourCounts = new Array(24).fill(0);
    
    games.forEach(game => {
      const hour = new Date(game.createdAt).getHours();
      hourCounts[hour]++;
    });

    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));
    
    return {
      mostActive: mostActiveHour,
      distribution: hourCounts
    };
  }

  static isCurrentlyActiveTime(hour) {
    const currentHour = new Date().getHours();
    return Math.abs(currentHour - hour) <= 1;
  }

  static async analyzeFriendActivity(userId) {
    const user = await User.findById(userId).populate('friends.userId');
    
    const onlineFriends = user.friends.filter(friend => 
      friend.userId.isOnline && 
      friend.status === 'accepted'
    ).length;

    return { onlineFriends };
  }

  static async getAffordableProducts(userPoints) {
    const products = await Product.find({
      'gameReward.isGameReward': true,
      'gameReward.pointsRequired': { $lte: userPoints },
      isActive: true,
      stock: { $gt: 0 }
    }).limit(5);

    return products;
  }
}

module.exports = AIRecommendationEngine;