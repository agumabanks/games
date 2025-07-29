const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  room: { type: String, required: true },
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: String,
    position: Number
  }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gameMode: { 
    type: String, 
    enum: ['casual', 'ranked', 'tournament'], 
    default: 'casual' 
  },
  duration: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', GameSchema);
