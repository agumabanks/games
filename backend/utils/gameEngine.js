const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class MatatuGameEngine {
  constructor(gameType = 'casual') {
    this.gameType = gameType; // 'casual', 'tournament', 'ranked'
    this.deck = [];
    this.discardPile = [];
    this.players = new Map();
    this.currentPlayer = null;
    this.gameStarted = false;
    this.gameEnded = false;
    this.winner = null;
    this.startTime = null;
    this.endTime = null;
    this.specialRules = {
      matatuCallRequired: true,
      timeLimit: gameType === 'tournament' ? 300 : 0, // 5 minutes for tournaments
      spectatorMode: gameType === 'tournament'
    };
  }

  createDeck() {
    const deck = [];
    SUITS.forEach(suit => {
      RANKS.forEach(rank => {
        deck.push({ 
          suit, 
          rank, 
          id: `${rank}_${suit}`,
          points: this.getCardPoints(rank)
        });
      });
    });
    return this.shuffleDeck(deck);
  }

  getCardPoints(rank) {
    const pointValues = {
      '7': 7, '8': 8, '9': 9, '10': 10,
      'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return pointValues[rank] || 0;
  }

  shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  addPlayer(playerId, playerData) {
    if (this.players.size >= 4) {
      throw new Error('Game is full (max 4 players)');
    }

    this.players.set(playerId, {
      id: playerId,
      username: playerData.username,
      hand: [],
      points: playerData.points || 0,
      level: playerData.level || 'Beginner',
      hasCalledMatatu: false,
      timeLeft: this.specialRules.timeLimit,
      connected: true
    });

    return this.players.get(playerId);
  }

  startGame() {
    if (this.players.size < 2) {
      throw new Error('Need at least 2 players to start');
    }

    this.deck = this.createDeck();
    this.gameStarted = true;
    this.startTime = new Date();

    // Deal cards to players (5 cards each)
    const playerIds = Array.from(this.players.keys());
    playerIds.forEach(playerId => {
      const player = this.players.get(playerId);
      player.hand = this.deck.splice(0, 5);
    });

    // Set top card
    this.discardPile.push(this.deck.pop());
    this.currentPlayer = playerIds[0];

    return this.getGameState();
  }

  playCard(playerId, cardIndex) {
    if (!this.gameStarted || this.gameEnded) {
      throw new Error('Game not in progress');
    }

    if (this.currentPlayer !== playerId) {
      throw new Error('Not your turn');
    }

    const player = this.players.get(playerId);
    if (!player || cardIndex >= player.hand.length) {
      throw new Error('Invalid card');
    }

    const card = player.hand[cardIndex];
    const topCard = this.getTopCard();

    if (!this.isValidMove(card, topCard)) {
      throw new Error('Invalid move - card must match suit or rank');
    }

    // Play the card
    player.hand.splice(cardIndex, 1);
    this.discardPile.push(card);

    // Check for Matatu call requirement
    if (player.hand.length === 1 && !player.hasCalledMatatu && this.specialRules.matatuCallRequired) {
      // Player must call Matatu or draw penalty card
      player.hand.push(this.deck.pop());
    }

    // Check win condition
    if (player.hand.length === 0) {
      this.endGame(playerId);
      return { gameOver: true, winner: playerId };
    }

    // Handle special cards
    this.handleSpecialCard(card, playerId);

    // Move to next player
    this.nextTurn();

    return { success: true, gameState: this.getGameState() };
  }

  callMatatu(playerId) {
    const player = this.players.get(playerId);
    if (player && player.hand.length <= 2) {
      player.hasCalledMatatu = true;
      return true;
    }
    return false;
  }

  drawCard(playerId) {
    if (this.currentPlayer !== playerId) {
      throw new Error('Not your turn');
    }

    const player = this.players.get(playerId);
    if (this.deck.length === 0) {
      this.reshuffleDiscardPile();
    }

    if (this.deck.length > 0) {
      player.hand.push(this.deck.pop());
      this.nextTurn();
      return { success: true, card: player.hand[player.hand.length - 1] };
    }

    throw new Error('No cards available');
  }

  isValidMove(card, topCard) {
    if (!topCard) return true;
    return card.suit === topCard.suit || card.rank === topCard.rank;
  }

  handleSpecialCard(card, playerId) {
    switch (card.rank) {
      case 'A': // Ace - skip next player
        this.nextTurn();
        break;
      case 'K': // King - reverse direction (skip in 2-player)
        if (this.players.size > 2) {
          // Implement direction reversal for multiplayer
        } else {
          this.nextTurn();
        }
        break;
      case '8': // Eight - play again
        // Current player keeps turn
        break;
      case 'J': // Jack - wild card (handled in frontend)
        break;
    }
  }

  nextTurn() {
    const playerIds = Array.from(this.players.keys());
    const currentIndex = playerIds.indexOf(this.currentPlayer);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    this.currentPlayer = playerIds[nextIndex];
  }

  reshuffleDiscardPile() {
    if (this.discardPile.length <= 1) return;

    const topCard = this.discardPile.pop();
    this.deck = this.shuffleDeck(this.discardPile);
    this.discardPile = [topCard];
  }

  endGame(winnerId) {
    this.gameEnded = true;
    this.winner = winnerId;
    this.endTime = new Date();

    // Calculate points and rewards
    const winner = this.players.get(winnerId);
    const gameResults = this.calculateGameResults();

    return gameResults;
  }

  calculateGameResults() {
    const results = {
      winner: this.winner,
      duration: this.endTime - this.startTime,
      players: []
    };

    // Calculate points for each player
    this.players.forEach((player, playerId) => {
      const handPoints = player.hand.reduce((sum, card) => sum + card.points, 0);
      const isWinner = playerId === this.winner;
      
      let pointsChange = 0;
      if (isWinner) {
        // Winner gets points based on remaining cards in opponents' hands
        const opponentPoints = Array.from(this.players.values())
          .filter(p => p.id !== playerId)
          .reduce((sum, p) => sum + p.hand.reduce((s, c) => s + c.points, 0), 0);
        pointsChange = Math.min(opponentPoints * 10, 1000); // Max 1000 points per game
      } else {
        // Losers lose points based on their remaining cards
        pointsChange = -Math.min(handPoints * 5, 500); // Max loss 500 points
      }

      results.players.push({
        id: playerId,
        username: player.username,
        position: isWinner ? 1 : 2,
        pointsChange,
        cardsRemaining: player.hand.length,
        handPoints
      });
    });

    return results;
  }

  getGameState() {
    return {
      gameStarted: this.gameStarted,
      gameEnded: this.gameEnded,
      currentPlayer: this.currentPlayer,
      topCard: this.getTopCard(),
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        cardCount: p.hand.length,
        points: p.points,
        level: p.level,
        hasCalledMatatu: p.hasCalledMatatu,
        connected: p.connected
      })),
      deckCount: this.deck.length,
      winner: this.winner,
      gameType: this.gameType
    };
  }

  getTopCard() {
    return this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null;
  }

  getPlayerHand(playerId) {
    const player = this.players.get(playerId);
    return player ? player.hand : [];
  }
}

module.exports = MatatuGameEngine;