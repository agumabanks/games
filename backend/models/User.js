const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  // Basic Info
  username: { 
    type: String, 
    required: true, 
    unique: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: { type: String, required: true, minlength: 6 },
  
  // Game Stats
  points: { type: Number, default: 1000, min: 0 },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  
  // Profile & Social
  avatar: { type: String, default: 'default-avatar.png' },
  bio: { type: String, maxlength: 500 },
  country: { type: String, default: 'Kenya' },
  level: { 
    type: String, 
    enum: ['Beginner', 'Amateur', 'Intermediate', 'Advanced', 'Expert', 'Master'],
    default: 'Beginner' 
  },
  
  // Account Status
  isVerified: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
  
  // Soko 24 Integration
  soko24: {
    isVendor: { type: Boolean, default: false },
    shopName: String,
    productCategories: [String],
    totalSales: { type: Number, default: 0 },
    rating: { type: Number, default: 5.0, min: 1, max: 5 }
  },
  
  // Achievements & Badges
  achievements: [{
    name: String,
    description: String,
    earnedAt: { type: Date, default: Date.now },
    icon: String
  }],
  
  // Friend System
  friends: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' }
  }],
  
  // Settings
  preferences: {
    notifications: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    autoMatch: { type: Boolean, default: false },
    language: { type: String, default: 'en' }
  },
  
  createdAt: { type: Date, default: Date.now }
});

// Pre-save middleware
UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Calculate win rate
  if (this.gamesPlayed > 0) {
    this.winRate = Math.round((this.gamesWon / this.gamesPlayed) * 100);
  }
  
  // Update level based on performance
  this.updateLevel();
  this.lastActive = Date.now();
  next();
});

UserSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

UserSchema.methods.updateLevel = function() {
  const points = this.points;
  const winRate = this.winRate;
  
  if (points >= 10000 && winRate >= 75) this.level = 'Master';
  else if (points >= 5000 && winRate >= 65) this.level = 'Expert';
  else if (points >= 2500 && winRate >= 55) this.level = 'Advanced';
  else if (points >= 1000 && winRate >= 45) this.level = 'Intermediate';
  else if (points >= 500) this.level = 'Amateur';
  else this.level = 'Beginner';
};

module.exports = mongoose.model('User', UserSchema);