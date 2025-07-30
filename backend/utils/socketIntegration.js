const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

class Soko24Integration {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      // Handle Soko 24 specific events
      socket.on('soko24:getFeaturedProducts', async () => {
        try {
          const products = await Product.find({
            featuredInGame: true,
            isActive: true,
            stock: { $gt: 0 }
          }).limit(6);

          socket.emit('soko24:featuredProducts', products);
        } catch (error) {
          socket.emit('soko24:error', { message: 'Failed to load featured products' });
        }
      });

      socket.on('soko24:getGameRewards', async (data) => {
        try {
          const { userPoints } = data;

          const rewards = await Product.find({
            'gameReward.isGameReward': true,
            'gameReward.pointsRequired': { $lte: userPoints },
            isActive: true,
            stock: { $gt: 0 }
          }).sort({ 'gameReward.pointsRequired': 1 });

          socket.emit('soko24:gameRewards', rewards);
        } catch (error) {
          socket.emit('soko24:error', { message: 'Failed to load rewards' });
        }
      });

      socket.on('soko24:trackOrder', async (data) => {
        try {
          const order = await Order.findById(data.orderId)
            .populate('items.product', 'name images')
            .populate('user', 'username');

          if (order) {
            socket.emit('soko24:orderStatus', order);
          }
        } catch (error) {
          socket.emit('soko24:error', { message: 'Failed to track order' });
        }
      });
    });
  }

  // Send promotional notifications to game players
  async sendPromotion(promotion) {
    this.io.emit('soko24:promotion', {
      title: promotion.title,
      description: promotion.description,
      discount: promotion.discount,
      products: promotion.products,
      validUntil: promotion.validUntil
    });
  }

  // Notify users about new rewards based on their points
  async notifyEligibleUsers(product) {
    if (product.gameReward.isGameReward) {
      // Find users with enough points
      const eligibleUsers = await User.find({
        points: { $gte: product.gameReward.pointsRequired },
        isOnline: true
      });

      eligibleUsers.forEach(user => {
        // Find user's socket and send notification
        const userSocket = this.findUserSocket(user._id);
        if (userSocket) {
          userSocket.emit('soko24:newRewardAvailable', {
            product: {
              id: product._id,
              name: product.name,
              pointsRequired: product.gameReward.pointsRequired,
              image: product.images[0]
            }
          });
        }
      });
    }
  }

  findUserSocket(userId) {
    // Implementation to find user's socket connection
    for (const [socketId, socket] of this.io.sockets.sockets) {
      if (socket.userId === userId.toString()) {
        return socket;
      }
    }
    return null;
  }
}

module.exports = Soko24Integration;
