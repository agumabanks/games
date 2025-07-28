// PWA Implementation - Service Worker
// frontend/public/sw.js - Enhanced Service Worker
const CACHE_NAME = 'matatu-online-v3.0.0';
const STATIC_CACHE = 'matatu-static-v3.0.0';
const DYNAMIC_CACHE = 'matatu-dynamic-v3.0.0';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/images/logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.socket.io/4.7.2/socket.io.min.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Cache failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful navigation responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Serve offline page for navigation failures
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses for offline use
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Try to serve from cache if network fails
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return offline response for critical API calls
              return new Response(
                JSON.stringify({ 
                  error: 'Offline', 
                  message: 'This feature requires internet connection' 
                }),
                { 
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone and cache the response
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseToCache));

            return response;
          })
          .catch(() => {
            // For image requests, return a placeholder
            if (request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">Image Offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            
            // For other requests, try to return a cached version
            return caches.match('/offline.html');
          });
      })
  );
});

// Background sync for offline game moves
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'game-move-sync') {
    event.waitUntil(syncGameMoves());
  } else if (event.tag === 'chat-message-sync') {
    event.waitUntil(syncChatMessages());
  }
});

// Push notification handling
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  let notificationData = {
    title: 'Matatu Online',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'matatu-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };

  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = { ...notificationData, ...pushData };
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no existing window, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Sync functions
async function syncGameMoves() {
  try {
    const cache = await caches.open('offline-game-moves');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
          console.log('[SW] Synced game move:', request.url);
        }
      } catch (error) {
        console.error('[SW] Failed to sync game move:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

async function syncChatMessages() {
  try {
    const cache = await caches.open('offline-chat-messages');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
          console.log('[SW] Synced chat message:', request.url);
        }
      } catch (error) {
        console.error('[SW] Failed to sync chat message:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Chat sync error:', error);
  }
}

// Advanced Analytics Implementation
// backend/utils/advancedAnalytics.js
const User = require('../models/User');
const Game = require('../models/Game');
const Product = require('../models/Product');
const Order = require('../models/Order');

class AdvancedAnalytics {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
  }

  // Real-time metrics collection
  recordEvent(eventType, data) {
    const timestamp = Date.now();
    const event = {
      type: eventType,
      data,
      timestamp,
      sessionId: data.sessionId || 'unknown'
    };

    // Store in memory for real-time access
    if (!this.metrics.has(eventType)) {
      this.metrics.set(eventType, []);
    }
    this.metrics.get(eventType).push(event);

    // Keep only last 1000 events of each type in memory
    const events = this.metrics.get(eventType);
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }

    // Async database storage (don't await to avoid blocking)
    this.storeEventAsync(event);
  }

  async storeEventAsync(event) {
    try {
      // Store in MongoDB for historical analysis
      // You could create an Events collection for this
      console.log('Storing event:', event.type);
    } catch (error) {
      console.error('Error storing analytics event:', error);
    }
  }

  // User behavior analysis
  async getUserBehaviorAnalysis(userId, period = '30d') {
    const dateThreshold = this.getPeriodDate(period);
    
    try {
      const [gameStats, purchaseStats, sessionStats] = await Promise.all([
        this.getGameBehavior(userId, dateThreshold),
        this.getPurchaseBehavior(userId, dateThreshold),
        this.getSessionBehavior(userId, dateThreshold)
      ]);

      return {
        games: gameStats,
        purchases: purchaseStats,
        sessions: sessionStats,
        engagement: this.calculateEngagementScore(gameStats, purchaseStats, sessionStats)
      };
    } catch (error) {
      console.error('Error analyzing user behavior:', error);
      return null;
    }
  }

  async getGameBehavior(userId, dateThreshold) {
    const games = await Game.find({
      'players.userId': userId,
      createdAt: { $gte: dateThreshold }
    });

    const totalGames = games.length;
    const wins = games.filter(game => game.winner?.toString() === userId).length;
    const avgDuration = games.reduce((sum, game) => sum + game.duration, 0) / totalGames || 0;
    
    // Calculate play patterns
    const playTimesByHour = new Array(24).fill(0);
    const playTimesByDay = new Array(7).fill(0);
    
    games.forEach(game => {
      const date = new Date(game.createdAt);
      playTimesByHour[date.getHours()]++;
      playTimesByDay[date.getDay()]++;
    });

    return {
      totalGames,
      wins,
      winRate: totalGames > 0 ? (wins / totalGames) * 100 : 0,
      avgDuration,
      preferredPlayHours: playTimesByHour.indexOf(Math.max(...playTimesByHour)),
      preferredPlayDays: playTimesByDay.indexOf(Math.max(...playTimesByDay)),
      consistency: this.calculatePlayConsistency(games)
    };
  }

  async getPurchaseBehavior(userId, dateThreshold) {
    const orders = await Order.find({
      user: userId,
      createdAt: { $gte: dateThreshold }
    }).populate('items.product');

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const pointsUsed = orders.reduce((sum, order) => sum + order.pointsUsed, 0);

    // Category preferences
    const categoryPurchases = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const category = item.product?.category || 'unknown';
        categoryPurchases[category] = (categoryPurchases[category] || 0) + 1;
      });
    });

    return {
      totalOrders,
      totalSpent,
      pointsUsed,
      avgOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
      preferredCategories: Object.entries(categoryPurchases)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3),
      conversionFromGame: this.calculateGameToShopConversion(userId, dateThreshold)
    };
  }

  async getSessionBehavior(userId, dateThreshold) {
    // This would require session tracking implementation
    // For now, return estimated data based on game activity
    const games = await Game.find({
      'players.userId': userId,
      createdAt: { $gte: dateThreshold }
    });

    const sessions = this.estimateSessionsFromGames(games);
    
    return {
      totalSessions: sessions.length,
      avgSessionDuration: sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length || 0,
      avgGamesPerSession: games.length / sessions.length || 0,
      retentionRate: this.calculateRetentionRate(userId, dateThreshold)
    };
  }

  calculateEngagementScore(gameStats, purchaseStats, sessionStats) {
    // Weighted engagement score (0-100)
    const gameScore = Math.min(gameStats.totalGames * 2, 40); // Max 40 points
    const purchaseScore = Math.min(purchaseStats.totalOrders * 10, 30); // Max 30 points
    const sessionScore = Math.min(sessionStats.totalSessions * 3, 30); // Max 30 points
    
    return Math.round(gameScore + purchaseScore + sessionScore);
  }

  // Business intelligence methods
  async getBusinessMetrics(period = '30d') {
    const dateThreshold = this.getPeriodDate(period);

    try {
      const [userMetrics, gameMetrics, revenueMetrics, conversionMetrics] = await Promise.all([
        this.getUserMetrics(dateThreshold),
        this.getGameMetrics(dateThreshold),
        this.getRevenueMetrics(dateThreshold),
        this.getConversionMetrics(dateThreshold)
      ]);

      return {
        users: userMetrics,
        games: gameMetrics,
        revenue: revenueMetrics,
        conversions: conversionMetrics,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating business metrics:', error);
      return null;
    }
  }

  async getUserMetrics(dateThreshold) {
    const totalUsers = await User.countDocuments();
    const newUsers = await User.countDocuments({ createdAt: { $gte: dateThreshold } });
    const activeUsers = await User.countDocuments({ 
      lastActive: { $gte: dateThreshold } 
    });

    // User distribution by level
    const usersByLevel = await User.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } }
    ]);

    return {
      total: totalUsers,
      new: newUsers,
      active: activeUsers,
      retentionRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
      distribution: usersByLevel
    };
  }

  async getGameMetrics(dateThreshold) {
    const totalGames = await Game.countDocuments({ createdAt: { $gte: dateThreshold } });
    const avgDuration = await Game.aggregate([
      { $match: { createdAt: { $gte: dateThreshold } } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
    ]);

    // Games by mode
    const gamesByMode = await Game.aggregate([
      { $match: { createdAt: { $gte: dateThreshold } } },
      { $group: { _id: '$gameMode', count: { $sum: 1 } } }
    ]);

    return {
      total: totalGames,
      avgDuration: avgDuration[0]?.avgDuration || 0,
      byMode: gamesByMode,
      peakHours: await this.getGamePeakHours(dateThreshold)
    };
  }

  async getRevenueMetrics(dateThreshold) {
    const revenueData = await Order.aggregate([
      { $match: { createdAt: { $gte: dateThreshold } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          totalPointsUsed: { $sum: '$pointsUsed' }
        }
      }
    ]);

    const revenue = revenueData[0] || { totalRevenue: 0, totalOrders: 0, totalPointsUsed: 0 };

    return {
      total: revenue.totalRevenue,
      orders: revenue.totalOrders,
      pointsUsed: revenue.totalPointsUsed,
      avgOrderValue: revenue.totalOrders > 0 ? revenue.totalRevenue / revenue.totalOrders : 0
    };
  }

  async getConversionMetrics(dateThreshold) {
    const gameUsers = await Game.distinct('players.userId', { 
      createdAt: { $gte: dateThreshold } 
    });
    
    const purchaseUsers = await Order.distinct('user', { 
      createdAt: { $gte: dateThreshold } 
    });

    const gameToShopConversion = gameUsers.filter(userId => 
      purchaseUsers.some(purchaseUserId => 
        purchaseUserId.toString() === userId.toString()
      )
    ).length;

    return {
      gameUsers: gameUsers.length,
      purchaseUsers: purchaseUsers.length,
      gameToShopConversion,
      conversionRate: gameUsers.length > 0 ? 
        (gameToShopConversion / gameUsers.length) * 100 : 0
    };
  }

  // AI-powered features
  async generateUserRecommendations(userId) {
    try {
      const behavior = await this.getUserBehaviorAnalysis(userId);
      if (!behavior) return [];

      const recommendations = [];

      // Game-based recommendations
      if (behavior.games.winRate > 70) {
        recommendations.push({
          type: 'tournament',
          title: 'Join Advanced Tournament',
          description: 'Your win rate qualifies you for premium tournaments',
          action: 'join_tournament',
          priority: 'high'
        });
      }

      // Purchase-based recommendations
      if (behavior.purchases.totalOrders === 0 && behavior.games.totalGames > 5) {
        recommendations.push({
          type: 'shop',
          title: 'Redeem Your Points',
          description: 'You have earned points! Check out our rewards',
          action: 'view_rewards',
          priority: 'medium'
        });
      }

      // Engagement-based recommendations
      if (behavior.engagement < 30) {
        recommendations.push({
          type: 'engagement',
          title: 'Daily Challenge',
          description: 'Complete daily challenges for bonus points',
          action: 'daily_challenge',
          priority: 'low'
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  }

  async predictChurnRisk(userId) {
    try {
      const behavior = await this.getUserBehaviorAnalysis(userId, '7d');
      const historicalBehavior = await this.getUserBehaviorAnalysis(userId, '30d');
      
      let riskScore = 0;
      
      // Analyze activity decline
      if (behavior.games.totalGames < historicalBehavior.games.totalGames * 0.3) {
        riskScore += 30;
      }
      
      // Analyze engagement drop
      if (behavior.engagement < historicalBehavior.engagement * 0.5) {
        riskScore += 25;
      }
      
      // Analyze session patterns
      if (behavior.sessions.totalSessions < 2) {
        riskScore += 20;
      }
      
      // Analyze purchase behavior
      if (behavior.purchases.totalOrders === 0 && historicalBehavior.purchases.totalOrders > 0) {
        riskScore += 25;
      }

      let riskLevel = 'low';
      if (riskScore >= 70) riskLevel = 'high';
      else if (riskScore >= 40) riskLevel = 'medium';

      return {
        riskScore: Math.min(riskScore, 100),
        riskLevel,
        factors: this.identifyChurnFactors(behavior, historicalBehavior),
        retentionActions: this.suggestRetentionActions(riskLevel, behavior)
      };
    } catch (error) {
      console.error('Error predicting churn risk:', error);
      return { riskScore: 0, riskLevel: 'unknown', factors: [], retentionActions: [] };
    }
  }

  // Helper methods
  getPeriodDate(period) {
    const now = new Date();
    const periods = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    
    const days = periods[period] || 30;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  calculatePlayConsistency(games) {
    if (games.length < 2) return 0;
    
    const timeDiffs = [];
    for (let i = 1; i < games.length; i++) {
      const diff = games[i].createdAt - games[i-1].createdAt;
      timeDiffs.push(diff);
    }
    
    const avgDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    const variance = timeDiffs.reduce((sum, diff) => sum + Math.pow(diff - avgDiff, 2), 0) / timeDiffs.length;
    
    // Lower variance = higher consistency
    return Math.max(0, 100 - (variance / avgDiff) * 100);
  }

  async calculateGameToShopConversion(userId, dateThreshold) {
    const games = await Game.find({
      'players.userId': userId,
      createdAt: { $gte: dateThreshold }
    });
    
    const orders = await Order.find({
      user: userId,
      createdAt: { $gte: dateThreshold }
    });

    // Calculate conversion rate based on game sessions leading to purchases
    return {
      gamesPlayed: games.length,
      ordersPlaced: orders.length,
      conversionRate: games.length > 0 ? (orders.length / games.length) * 100 : 0
    };
  }

  estimateSessionsFromGames(games) {
    // Group games by time windows to estimate sessions
    const sessions = [];
    let currentSession = null;
    const sessionGap = 30 * 60 * 1000; // 30 minutes

    games.sort((a, b) => a.createdAt - b.createdAt);

    games.forEach(game => {
      if (!currentSession || 
          (game.createdAt - currentSession.endTime) > sessionGap) {
        currentSession = {
          startTime: game.createdAt,
          endTime: new Date(game.createdAt.getTime() + game.duration * 1000),
          games: 1,
          duration: game.duration
        };
        sessions.push(currentSession);
      } else {
        currentSession.endTime = new Date(game.createdAt.getTime() + game.duration * 1000);
        currentSession.games++;
        currentSession.duration = currentSession.endTime - currentSession.startTime;
      }
    });

    return sessions;
  }

  async calculateRetentionRate(userId, dateThreshold) {
    const user = await User.findById(userId);
    if (!user) return 0;

    const daysSinceJoin = (Date.now() - user.createdAt) / (24 * 60 * 60 * 1000);
    const daysSinceLastActive = (Date.now() - user.lastActive) / (24 * 60 * 60 * 1000);

    // Simple retention calculation
    if (daysSinceJoin < 7) return 100; // New users get 100%
    return Math.max(0, 100 - (daysSinceLastActive / daysSinceJoin) * 100);
  }

  async getGamePeakHours(dateThreshold) {
    const games = await Game.find({ createdAt: { $gte: dateThreshold } });
    const hourCounts = new Array(24).fill(0);
    
    games.forEach(game => {
      const hour = new Date(game.createdAt).getHours();
      hourCounts[hour]++;
    });

    return hourCounts.map((count, hour) => ({ hour, count }))
                   .sort((a, b) => b.count - a.count)
                   .slice(0, 3);
  }

  identifyChurnFactors(current, historical) {
    const factors = [];
    
    if (current.games.totalGames < historical.games.totalGames * 0.3) {
      factors.push('Decreased gaming activity');
    }
    
    if (current.sessions.totalSessions < 2) {
      factors.push('Low session frequency');
    }
    
    if (current.engagement < 30) {
      factors.push('Low overall engagement');
    }

    return factors;
  }

  suggestRetentionActions(riskLevel, behavior) {
    const actions = [];
    
    if (riskLevel === 'high') {
      actions.push('Send personalized re-engagement email');
      actions.push('Offer bonus points or rewards');
      actions.push('Invite to exclusive tournament');
    } else if (riskLevel === 'medium') {
      actions.push('Send game tips and strategies');
      actions.push('Recommend new features');
      actions.push('Offer friend referral bonus');
    }

    return actions;
  }
}

module.exports = AdvancedAnalytics;

// Real-time Notifications System
// backend/utils/notificationSystem.js
const webpush = require('web-push');
const User = require('../models/User');

class NotificationSystem {
  constructor() {
    // Configure web-push with your VAPID keys
    webpush.setVapidDetails(
      'mailto:your-email@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }

  async sendNotification(userId, notification) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.pushSubscription) {
        console.log('User has no push subscription');
        return false;
      }

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: notification.tag || 'general',
        data: notification.data || {},
        requireInteraction: notification.requireInteraction || false,
        actions: notification.actions || []
      });

      await webpush.sendNotification(user.pushSubscription, payload);
      console.log('Push notification sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      
      // Remove invalid subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        await User.findByIdAndUpdate(userId, {
          $unset: { pushSubscription: 1 }
        });
      }
      
      return false;
    }
  }

  async sendBulkNotification(userIds, notification) {
    const promises = userIds.map(userId => 
      this.sendNotification(userId, notification)
    );
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    console.log(`Bulk notification sent to ${successful}/${userIds.length} users`);
    return { sent: successful, total: userIds.length };
  }

  async notifyGameInvitation(inviterUsername, inviteeUserId, roomCode) {
    return this.sendNotification(inviteeUserId, {
      title: 'Game Invitation',
      body: `${inviterUsername} invited you to play Matatu!`,
      tag: 'game-invitation',
      requireInteraction: true,
      data: {
        type: 'game_invitation',
        roomCode,
        inviter: inviterUsername,
        url: `/?join=${roomCode}`
      },
      actions: [
        {
          action: 'join',
          title: 'Join Game',
          icon: '/icons/play.png'
        },
        {
          action: 'decline',
          title: 'Decline',
          icon: '/icons/close.png'
        }
      ]
    });
  }

  async notifyTournamentStart(userId, tournamentName) {
    return this.sendNotification(userId, {
      title: 'Tournament Starting!',
      body: `${tournamentName} is about to begin. Join now!`,
      tag: 'tournament-start',
      requireInteraction: true,
      data: {
        type: 'tournament_start',
        url: '/tournaments'
      }
    });
  }

  async notifyAchievementUnlocked(userId, achievement) {
    return this.sendNotification(userId, {
      title: 'Achievement Unlocked! 🏆',
      body: `You earned: ${achievement.name}`,
      tag: 'achievement',
      data: {
        type: 'achievement',
        achievement: achievement.name,
        url: '/profile'
      }
    });
  }

  async notifyOrderShipped(userId, orderNumber, trackingNumber) {
    return this.sendNotification(userId, {
      title: 'Order Shipped! 📦',
      body: `Your order #${orderNumber} has been shipped`,
      tag: 'order-shipped',
      data: {
        type: 'order_update',
        orderNumber,
        trackingNumber,
        url: `/orders/${orderNumber}`
      }
    });
  }

  async notifyDailyBonus(userId, bonusAmount) {
    return this.sendNotification(userId, {
      title: 'Daily Bonus Available! 🎁',
      body: `Claim your ${bonusAmount} bonus points`,
      tag: 'daily-bonus',
      data: {
        type: 'daily_bonus',
        amount: bonusAmount,
        url: '/daily-bonus'
      }
    });
  }
}

module.exports = NotificationSystem;

// Advanced Mobile Optimization
// frontend/public/js/mobileOptimizations.js
class MobileOptimizations {
  constructor() {
    this.isTouch = 'ontouchstart' in window;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    this.init();
  }

  init() {
    if (this.isMobile) {
      this.optimizeForMobile();
      this.addMobileGestures();
      this.preventZoom();
      this.optimizeTouch();
    }

    if (this.isStandalone) {
      this.handleStandaloneMode();
    }

    this.addInstallPrompt();
  }

  optimizeForMobile() {
    // Add mobile-specific CSS classes
    document.body.classList.add('mobile-device');
    
    // Optimize viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    }

    // Add safe area padding for notched devices
    document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
  }

  addMobileGestures() {
    let startX, startY, endX, endY;

    // Swipe gestures for navigation
    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!startX || !startY) return;

      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;

      const diffX = startX - endX;
      const diffY = startY - endY;

      // Minimum swipe distance
      if (Math.abs(diffX) > 50 || Math.abs(diffY) > 50) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
          // Horizontal swipe
          if (diffX > 0) {
            this.handleSwipeLeft();
          } else {
            this.handleSwipeRight();
          }
        } else {
          // Vertical swipe
          if (diffY > 0) {
            this.handleSwipeUp();
          } else {
            this.handleSwipeDown();
          }
        }
      }

      // Reset
      startX = startY = endX = endY = null;
    }, { passive: true });
  }

  handleSwipeLeft() {
    // Navigate to next section or close chat
    if (document.getElementById('chatContainer').classList.contains('open')) {
      toggleChat();
    }
  }

  handleSwipeRight() {
    // Navigate to previous section or open chat
    if (!document.getElementById('chatContainer').classList.contains('open')) {
      toggleChat();
    }
  }

  handleSwipeUp() {
    // Could implement quick actions menu
    console.log('Swipe up detected');
  }

  handleSwipeDown() {
    // Could implement refresh or pull-to-refresh
    console.log('Swipe down detected');
  }

  preventZoom() {
    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  }

  optimizeTouch() {
    // Add larger touch targets for mobile
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        .btn, .card, .nav-tab {
          min-height: 44px;
          min-width: 44px;
        }
        
        .card {
          margin: 8px 4px;
        }
        
        .chat-input {
          font-size: 16px; /* Prevent zoom on iOS */
        }
        
        /* Improve scrolling on iOS */
        .chat-messages, .room-list {
          -webkit-overflow-scrolling: touch;
        }
      }
    `;
    document.head.appendChild(style);
  }

  handleStandaloneMode() {
    // Add padding for status bar in standalone mode
    document.body.classList.add('standalone-mode');
    
    // Handle navigation in standalone mode
    window.addEventListener('beforeunload', (e) => {
      // Could implement custom navigation confirmation
    });
  }

  addInstallPrompt() {
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show custom install button
      this.showInstallButton(deferredPrompt);
    });

    // Track installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      this.hideInstallButton();
      
      // Analytics: track PWA installs
      if (typeof gtag !== 'undefined') {
        gtag('event', 'pwa_install', {
          event_category: 'engagement',
          event_label: 'PWA Installation'
        });
      }
    });
  }

  showInstallButton(deferredPrompt) {
    const installButton = document.createElement('button');
    installButton.className = 'install-button';
    installButton.innerHTML = '<i class="fas fa-download"></i> Install App';
    installButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(45deg, #667eea, #764ba2);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 25px;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      z-index: 10000;
      transition: all 0.3s ease;
    `;

    installButton.addEventListener('click', async () => {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      deferredPrompt = null;
      this.hideInstallButton();
    });

    document.body.appendChild(installButton);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      this.hideInstallButton();
    }, 10000);
  }

  hideInstallButton() {
    const installButton = document.querySelector('.install-button');
    if (installButton) {
      installButton.remove();
    }
  }

  // Vibration feedback for touch interactions
  vibrate(pattern = [100]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // Haptic feedback for game events
  gameVibration(eventType) {
    const patterns = {
      cardPlay: [50],
      win: [100, 50, 100, 50, 200],
      lose: [200],
      notification: [100, 50, 100],
      error: [300]
    };

    this.vibrate(patterns[eventType] || [50]);
  }
}

// Initialize mobile optimizations
if (typeof window !== 'undefined') {
  window.mobileOpt = new MobileOptimizations();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileOptimizations;
}