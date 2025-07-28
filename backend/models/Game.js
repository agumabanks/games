const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  room: String,
  players: [String],
  winner: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', GameSchema);
