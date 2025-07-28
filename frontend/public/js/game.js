// frontend/public/js/game.js - Complete Game Client
class MatatuGameClient {
  constructor() {
    this.socket = null;
    this.gameState = null;
    this.playerHand = [];
    this.currentRoom = null;
    this.isMyTurn = false;
    this.selectedCard = null;
    
    this.initializeEventListeners();
  }

  connect() {
    this.socket = io();
    
    this.socket.on('connect', () => {
      console.log('Connected to game server');
      this.authenticateSocket();
    });

    this.socket.on('gameStateUpdate', (state) => {
      this.updateGameState(state);
    });

    this.socket.on('cardPlayed', (data) => {
      this.handleCardPlayed(data);
    });

    this.socket.on('gameOver', (data) => {
      this.handleGameOver(data);
    });

    this.socket.on('error', (error) => {
      this.showError(error.message);
    });
  }

  authenticateSocket() {
    const token = localStorage.getItem('matatuToken');
    const user = JSON.parse(localStorage.getItem('matatuUser') || '{}');
    
    if (token && user.id) {
      this.socket.emit('userAuth', {
        id: user.id,
        username: user.username,
        token
      });
    }
  }

  joinRoom(roomId) {
    if (!this.socket) {
      this.showError('Not connected to server');
      return;
    }

    this.socket.emit('joinRoom', { roomId });
    this.currentRoom = roomId;
  }

  playCard(cardIndex) {
    if (!this.isMyTurn) {
      this.showError("It's not your turn");
      return;
    }

    if (!this.socket || !this.currentRoom) {
      this.showError('Not connected to game');
      return;
    }

    this.socket.emit('playCard', {
      room: this.currentRoom,
      cardIndex
    });
  }

  drawCard() {
    if (!this.isMyTurn) {
      this.showError("It's not your turn");
      return;
    }

    this.socket.emit('drawCard', {
      room: this.currentRoom
    });
  }

  updateGameState(state) {
    this.gameState = state;
    this.playerHand = state.myHand || [];
    this.isMyTurn = state.currentTurn === JSON.parse(localStorage.getItem('matatuUser') || '{}').id;
    
    this.renderGameUI();
  }

  handleCardPlayed(data) {
    // Update UI to show played card
    this.showCardAnimation(data.card);
    this.updateDiscardPile(data.card);
    
    // Handle special card effects
    if (data.effects) {
      this.handleSpecialEffects(data.effects);
    }
  }

  handleGameOver(data) {
    this.showGameOverModal(data);
    this.updatePlayerStats(data.results);
  }

  renderGameUI() {
    // Render player hand
    this.renderPlayerHand();
    
    // Update game info
    this.updateGameInfo();
    
    // Update turn indicator
    this.updateTurnIndicator();
    
    // Update other players' info
    this.updateOtherPlayers();
  }

  renderPlayerHand() {
    const handContainer = document.getElementById('playerHand');
    if (!handContainer) return;

    handContainer.innerHTML = '';

    this.playerHand.forEach((card, index) => {
      const cardElement = this.createCardElement(card, index);
      handContainer.appendChild(cardElement);
    });
  }

  createCardElement(card, index) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `card ${card.suit} ${this.selectedCard === index ? 'selected' : ''}`;
    cardDiv.innerHTML = `
      <div class="card-inner">
        <div class="card-rank">${card.rank}</div>
        <div class="card-suit">${this.getSuitSymbol(card.suit)}</div>
      </div>
    `;

    cardDiv.addEventListener('click', () => {
      if (this.isMyTurn) {
        this.selectCard(index);
      }
    });

    return cardDiv;
  }

  selectCard(index) {
    // Remove previous selection
    document.querySelectorAll('.card.selected').forEach(el => {
      el.classList.remove('selected');
    });

    // Select new card
    this.selectedCard = index;
    const cardElements = document.querySelectorAll('.card');
    if (cardElements[index]) {
      cardElements[index].classList.add('selected');
    }

    // Enable play button
    const playButton = document.getElementById('playCardBtn');
    if (playButton) {
      playButton.disabled = false;
    }
  }

  getSuitSymbol(suit) {
    const symbols = {
      hearts: '♥️',
      diamonds: '♦️',
      clubs: '♣️',
      spades: '♠️'
    };
    return symbols[suit] || suit;
  }

  initializeEventListeners() {
    document.addEventListener('DOMContentLoaded', () => {
      // Play card button
      const playButton = document.getElementById('playCardBtn');
      if (playButton) {
        playButton.addEventListener('click', () => {
          if (this.selectedCard !== null) {
            this.playCard(this.selectedCard);
          }
        });
      }

      // Draw card button
      const drawButton = document.getElementById('drawCardBtn');
      if (drawButton) {
        drawButton.addEventListener('click', () => {
          this.drawCard();
        });
      }

      // Quick match button
      const quickMatchButton = document.getElementById('quickMatchBtn');
      if (quickMatchButton) {
        quickMatchButton.addEventListener('click', () => {
          this.findQuickMatch();
        });
      }
    });
  }

  findQuickMatch() {
    if (!this.socket) {
      this.showError('Not connected to server');
      return;
    }

    this.socket.emit('quickMatch', {
      skill: 'any',
      gameType: 'casual'
    });

    this.showMessage('Looking for opponents...');
  }

  showError(message) {
    // Show error toast or modal
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  showMessage(message) {
    // Show info message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'info-toast';
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }
}

// Initialize game client
const gameClient = new MatatuGameClient();

// Auto-connect when page loads
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('matatuToken');
  if (token) {
    gameClient.connect();
  }
});