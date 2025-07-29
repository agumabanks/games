const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  entryFee: { type: Number, required: true, min: 0 },
  maxParticipants: { type: Number, default: 16 },
  prizePool: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['upcoming', 'registration', 'ongoing', 'completed'],
    default: 'upcoming'
  },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: String,
    registeredAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tournament', TournamentSchema);
