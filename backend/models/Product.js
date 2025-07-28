const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0 },
  category: { 
    type: String, 
    enum: ['electronics', 'fashion', 'home', 'sports', 'books', 'other'],
    required: true 
  },
  
  // Product Details
  images: [{ type: String }],
  tags: [String],
  specifications: [{
    key: String,
    value: String
  }],
  
  // Vendor Information
  vendor: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    rating: { type: Number, default: 5.0, min: 1, max: 5 }
  },
  
  // Inventory
  stock: { type: Number, default: 0, min: 0 },
  sold: { type: Number, default: 0 },
  
  // Game Integration
  gameReward: {
    isGameReward: { type: Boolean, default: false },
    pointsRequired: { type: Number, min: 0 },
    tournamentPrize: { type: Boolean, default: false }
  },
  
  // Promotion
  featuredInGame: { type: Boolean, default: false },
  promoCode: String,
  
  // Status
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Index for better search performance
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ 'vendor.id': 1 });
ProductSchema.index({ featuredInGame: 1 });

module.exports = mongoose.model('Product', ProductSchema);