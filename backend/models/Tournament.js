const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  
  // Tournament Configuration
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'special'],
    default: 'daily'
  },
  maxParticipants: { type: Number, default: 16 },
  entryFee: { type: Number, required: true, min: 0 },
  prizePool: { type: Number, default: 0 },
  
  // Scheduling
  registrationStart: { type: Date, default: Date.now },
  registrationEnd: { type: Date, required: true },
  tournamentStart: { type: Date, required: true },
  tournamentEnd: Date,
  
  // Status
  status: {
    type: String,
    enum: ['upcoming', 'registration', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  
  // Participants
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: String,
    registeredAt: { type: Date, default: Date.now },
    eliminated: { type: Boolean, default: false },
    position: Number,
    prize: { type: Number, default: 0 }
  }],
  
  // Bracket System
  rounds: [{
    roundNumber: Number,
    matches: [{
      matchId: String,
      player1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      player2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
      status: { type: String, enum: ['pending', 'ongoing', 'completed'], default: 'pending' },
      scheduledTime: Date,
      completedAt: Date
    }]
  }],
  
  // Prize Distribution
  prizeDistribution: [{
    position: Number,
    percentage: Number,
    amount: Number
  }],
  
  // Sponsorship (Soko 24 Integration)
  sponsor: {
    name: { type: String, default: 'Soko 24' },
    logo: String,
    website: { type: String, default: 'https://soko24.co.ke' },
    specialOffer: String // Special discount code for participants
  },
  
  createdAt: { type: Date, default: Date.now }
});

// Methods
TournamentSchema.methods.addParticipant = async function(userId, username) {
  if (this.participants.length >= this.maxParticipants) {
    throw new Error('Tournament is full');
  }
  
  if (this.status !== 'registration') {
    throw new Error('Registration is closed');
  }
  
  const existingParticipant = this.participants.find(p => 
    p.userId.toString() === userId.toString()
  );
  
  if (existingParticipant) {
    throw new Error('Already registered for this tournament');
  }
  
  this.participants.push({ userId, username });
  this.prizePool += this.entryFee;
  
  return this.save();
};

TournamentSchema.methods.generateBracket = function() {
  if (this.participants.length < 2) {
    throw new Error('Need at least 2 participants');
  }
  
  // Shuffle participants for fair bracket
  const shuffled = [...this.participants].sort(() => Math.random() - 0.5);
  
  // Create first round matches
  const firstRoundMatches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      firstRoundMatches.push({
        matchId: `match_${i/2 + 1}`,
        player1: shuffled[i].userId,
        player2: shuffled[i + 1].userId,
        scheduledTime: new Date(this.tournamentStart.getTime() + (i/2) * 30 * 60000) // 30 min intervals
      });
    }
  }
  
  this.rounds.push({
    roundNumber: 1,
    matches: firstRoundMatches
  });
  
  return this.save();
};

module.exports = mongoose.model('Tournament', TournamentSchema);