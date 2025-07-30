const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    priceAtTime: {
      type: Number,
      required: true,
      min: 0
    },
    pointsUsed: {
      type: Number,
      default: 0,
      min: 0
    }
  }],

  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  pointsUsed: {
    type: Number,
    default: 0,
    min: 0
  },

  paymentMethod: {
    type: String,
    enum: ['mpesa', 'card', 'points', 'mixed'],
    default: 'mpesa'
  },

  orderType: {
    type: String,
    enum: ['purchase', 'reward_redemption', 'tournament_prize'],
    default: 'purchase'
  },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },

  shippingAddress: {
    name: String,
    phone: String,
    address: String,
    city: String,
    county: String,
    postalCode: String
  },

  paymentDetails: {
    transactionId: String,
    mpesaCode: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    }
  },

  tracking: {
    trackingNumber: String,
    carrier: String,
    estimatedDelivery: Date,
    deliveredAt: Date
  },

  notes: String,

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

OrderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', OrderSchema);
