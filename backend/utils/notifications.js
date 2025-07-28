// backend/utils/notifications.js - Push Notification System
const webpush = require('web-push');
const User = require('../models/User');

webpush.setVapidDetails(
  'mailto:admin@matatu-online.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

class NotificationService {
  static async sendToUser(userId, notification) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.pushSubscription) {
        return false;
      }

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: notification.data || {}
      });

      await webpush.sendNotification(user.pushSubscription, payload);
      return true;

    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  static async notifyGameStart(playerIds, roomName) {
    const notification = {
      title: 'Game Starting!',
      body: `Your game in ${roomName} is about to begin`,
      data: { type: 'game_start', roomName }
    };

    const promises = playerIds.map(playerId => 
      this.sendToUser(playerId, notification)
    );

    await Promise.all(promises);
  }

  static async notifyTournamentStart(userId, tournamentName) {
    const notification = {
      title: 'Tournament Starting!',
      body: `${tournamentName} is beginning now`,
      data: { type: 'tournament_start' }
    };

    await this.sendToUser(userId, notification);
  }

  static async notifyAchievement(userId, achievement) {
    const notification = {
      title: 'Achievement Unlocked!',
      body: `You earned: ${achievement.name}`,
      icon: `/achievements/${achievement.icon}`,
      data: { type: 'achievement', achievement }
    };

    await this.sendToUser(userId, notification);
  }
}

module.exports = NotificationService;