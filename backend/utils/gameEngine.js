// backend/utils/gameEngine.js - Matatu Game Engine
class MatatuGameEngine {
  constructor(gameType = 'casual') {
    this.gameType = gameType;
    this.deck = this.createDeck();
    this.players = new Map();
    this.currentPlayer = 0;
    this.direction = 1; // 1 for clockwise, -1 for counterclockwise
    this.discardPile = [];
    this.drawPile = [];
    this.gameState = 'waiting'; // waiting, active, finished
    this.specialRules = this.initializeSpecialRules();
    this.moves = [];
    this.startTime = null;
  }

  createDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];

    suits.forEach(suit => {
      ranks.forEach(rank => {
        deck.push({
          suit,
          rank,
          value: this.getCardValue(rank),
          isSpecial: this.isSpecialCard(rank, suit)
        });
      });
    });

    return this.shuffleDeck(deck);
  }

  getCardValue(rank) {
    const values = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
      '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank];
  }

  isSpecialCard(rank, suit) {
    // Matatu special cards (customizable based on house rules)
    const specialCards = ['8', 'J', 'A']; // 8 = skip, J = reverse, A = draw 4
    return specialCards.includes(rank);
  }

  initializeSpecialRules() {
    return {
      '8': { action: 'skip', description: 'Skip next player' },
      'J': { action: 'reverse', description: 'Reverse play direction' },
      'A': { action: 'draw', amount: 4, description: 'Next player draws 4 cards' },
      '2': { action: 'draw', amount: 2, description: 'Next player draws 2 cards' }
    };
  }

  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  startGame(playerIds) {
    if (playerIds.length < 2 || playerIds.length > 6) {
      throw new Error('Game requires 2-6 players');
    }

    this.gameState = 'active';
    this.startTime = Date.now();
    
    // Initialize players
    playerIds.forEach((playerId, index) => {
      this.players.set(playerId, {
        id: playerId,
        hand: [],
        position: index,
        stats: {
          cardsPlayed: 0,
          specialCardsPlayed: 0,
          turnsSkipped: 0
        }
      });
    });

    // Deal initial cards
    this.dealInitialCards();
    
    // Set up draw pile and discard pile
    this.drawPile = [...this.deck];
    const firstCard = this.drawPile.pop();
    this.discardPile.push(firstCard);

    return {
      gameStarted: true,
      firstCard: firstCard,
      currentPlayer: this.getCurrentPlayerId()
    };
  }

  dealInitialCards() {
    const cardsPerPlayer = 7; // Standard Matatu
    const playerIds = Array.from(this.players.keys());

    for (let i = 0; i < cardsPerPlayer; i++) {
      playerIds.forEach(playerId => {
        if (this.deck.length > 0) {
          const card = this.deck.pop();
          this.players.get(playerId).hand.push(card);
        }
      });
    }
  }

  getCurrentPlayerId() {
    const playerIds = Array.from(this.players.keys());
    return playerIds[this.currentPlayer];
  }

  canPlayCard(playerId, cardIndex) {
    const player = this.players.get(playerId);
    if (!player || cardIndex >= player.hand.length) {
      return { valid: false, reason: 'Invalid card selection' };
    }

    if (this.getCurrentPlayerId() !== playerId) {
      return { valid: false, reason: 'Not your turn' };
    }

    const card = player.hand[cardIndex];
    const topCard = this.discardPile[this.discardPile.length - 1];

    // Basic matching rules: same suit or same rank
    if (card.suit === topCard.suit || card.rank === topCard.rank) {
      return { valid: true };
    }

    return { valid: false, reason: 'Card does not match suit or rank' };
  }

  playCard(playerId, cardIndex, chosenSuit = null) {
    const validation = this.canPlayCard(playerId, cardIndex);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const player = this.players.get(playerId);
    const card = player.hand.splice(cardIndex, 1)[0];
    
    // Add to discard pile
    this.discardPile.push(card);
    
    // Update player stats
    player.stats.cardsPlayed++;
    if (card.isSpecial) {
      player.stats.specialCardsPlayed++;
    }

    // Record move
    this.moves.push({
      playerId,
      card,
      timestamp: Date.now(),
      gameTime: Date.now() - this.startTime
    });

    // Handle special card effects
    let gameEffects = this.handleSpecialCard(card, chosenSuit);

    // Check for win condition
    if (player.hand.length === 0) {
      this.gameState = 'finished';
      return {
        cardPlayed: card,
        winner: playerId,
        gameOver: true,
        duration: Date.now() - this.startTime,
        effects: gameEffects
      };
    }

    // Move to next player (unless skipped by special card)
    if (!gameEffects.skipNextPlayer) {
      this.nextPlayer();
    }

    return {
      cardPlayed: card,
      currentPlayer: this.getCurrentPlayerId(),
      gameOver: false,
      effects: gameEffects
    };
  }

  handleSpecialCard(card, chosenSuit = null) {
    const effects = {
      skipNextPlayer: false,
      reverseDirection: false,
      drawCards: 0,
      suitChanged: null
    };

    const rule = this.specialRules[card.rank];
    if (!rule) return effects;

    switch (rule.action) {
      case 'skip':
        effects.skipNextPlayer = true;
        this.nextPlayer(); // Skip the next player
        break;
        
      case 'reverse':
        this.direction *= -1;
        effects.reverseDirection = true;
        break;
        
      case 'draw':
        effects.drawCards = rule.amount;
        // Next player draws cards
        this.nextPlayer();
        const nextPlayerId = this.getCurrentPlayerId();
        const nextPlayer = this.players.get(nextPlayerId);
        
        for (let i = 0; i < rule.amount && this.drawPile.length > 0; i++) {
          nextPlayer.hand.push(this.drawPile.pop());
        }
        
        effects.skipNextPlayer = true; // Skip their turn after drawing
        break;
    }

    return effects;
  }

  nextPlayer() {
    const playerCount = this.players.size;
    this.currentPlayer = (this.currentPlayer + this.direction + playerCount) % playerCount;
  }

  drawCard(playerId) {
    if (this.getCurrentPlayerId() !== playerId) {
      throw new Error('Not your turn');
    }

    const player = this.players.get(playerId);
    
    if (this.drawPile.length === 0) {
      // Reshuffle discard pile (except top card) back into draw pile
      if (this.discardPile.length <= 1) {
        throw new Error('No cards available to draw');
      }
      
      const topCard = this.discardPile.pop();
      this.drawPile = this.shuffleDeck([...this.discardPile]);
      this.discardPile = [topCard];
    }

    const drawnCard = this.drawPile.pop();
    player.hand.push(drawnCard);
    
    // Move to next player
    this.nextPlayer();

    return {
      cardDrawn: true,
      currentPlayer: this.getCurrentPlayerId()
    };
  }

  getGameState() {
    return {
      gameState: this.gameState,
      currentPlayer: this.getCurrentPlayerId(),
      discardPile: this.discardPile.slice(-1), // Only show top card
      drawPileCount: this.drawPile.length,
      direction: this.direction,
      players: Array.from(this.players.entries()).map(([id, player]) => ({
        id,
        handSize: player.hand.length,
        stats: player.stats
      })),
      moves: this.moves.length,
      gameTime: this.startTime ? Date.now() - this.startTime : 0
    };
  }

  getPlayerHand(playerId) {
    const player = this.players.get(playerId);
    return player ? player.hand : [];
  }

  getGameResults() {
    if (this.gameState !== 'finished') {
      return null;
    }

    const results = Array.from(this.players.entries()).map(([id, player]) => ({
      playerId: id,
      position: player.hand.length === 0 ? 1 : player.hand.length + 1,
      cardsRemaining: player.hand.length,
      stats: player.stats
    }));

    // Sort by position
    results.sort((a, b) => a.position - b.position);

    return {
      winner: results[0].playerId,
      results,
      totalMoves: this.moves.length,
      gameDuration: Date.now() - this.startTime
    };
  }
}

module.exports = MatatuGameEngine;