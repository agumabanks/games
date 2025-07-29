const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    minlength: 3,
    maxlength: 20
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true
  },
  password: { type: String, required: true, minlength: 6 },
  points: { type: Number, default: 1000, min: 0 },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  level: { 
    type: String, 
    enum: ['Beginner', 'Amateur', 'Intermediate', 'Advanced', 'Expert', 'Master'],
    default: 'Beginner' 
  },
  isVerified: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  if (this.gamesPlayed > 0) {
    this.winRate = Math.round((this.gamesWon / this.gamesPlayed) * 100);
  }
  
  next();
});

UserSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', UserSchema);
