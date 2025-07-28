// backend/sockets/gameHandler.js - Enhanced Socket.IO Game Handler
const MatatuGameEngine = require('../utils/gameEngine');
const Game = require('../models/Game');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const AchievementSystem = require('../utils/achievementSystem');
const GameAnalytics = require('../utils/analytics');

module.exports = (io) => {
  // Global game state management
  const activeRooms = new Map(); // roomId -> GameRoom instance
  const waitingPlayers = new Map(); // skill level -> Set of players
  const connectedUsers = new Map(); // socketId -> user data
  const spectators = new Map(); // roomId -> Set of spectator sockets

  // Initialize waiting queues for different skill levels
  ['any', 'beginner', 'amateur', 'intermediate', 'advanced', 'expert', 'master'].forEach(level => {
    waitingPlayers.set(level, new Set());
  });

  // GameRoom class for managing individual game sessions
  class GameRoom {
    constructor(id, options = {}) {
      this.id = id;
      this.name = options.name || `Room ${id}`;
      this.maxPlayers = options.maxPlayers || 4;
      this.gameType = options.gameType || 'casual'; // casual, ranked, tournament
      this.betAmount = options.betAmount || 100;
      this.isPrivate = options.isPrivate || false;
      this.tournamentId = options.tournamentId || null;
      
      // Game engine
      this.engine = new MatatuGameEngine(this.gameType);
      this.created = Date.now();
      this.gameStartTime = null;
      
      // Player management
      this.players = new Map(); // playerId -> player data
      this.playerOrder = []; // Array of player IDs for turn order
      this.spectatorSockets = new Set();
      
      // Game state
      this.status = 'waiting'; // waiting, starting, active, completed
      this.winner = null;
      this.gameResults = null;
      
      // Chat history
      this.chatHistory = [];
      this.maxChatHistory = 50;
    }

    // Player management methods
    addPlayer(socket, userData) {
      if (this.players.size >= this.maxPlayers) {
        throw new Error('Room is full');
      }

      if (this.status === 'active') {
        throw new Error('Game in progress');
      }

      // Check if player has enough points for bet
      if (userData.points < this.betAmount) {
        throw new Error(`Insufficient points. Need ${this.betAmount} points to play.`);
      }

      const player = {
        id: userData.id,
        socketId: socket.id,
        username: userData.username,
        level: userData.level || 'Beginner',
        points: userData.points,
        avatar: userData.avatar || 'default-avatar.png',
        connected: true,
        joinedAt: Date.now(),
        stats: {
          cardsPlayed: 0,
          cardsDrawn: 0,
          matatuCalls: 0
        }
      };

      this.players.set(userData.id, player);
      this.playerOrder.push(userData.id);
      socket.join(this.id);

      // Add player to game engine
      this.engine.addPlayer(userData.id, userData);

      // Notify all players in room
      io.to(this.id).emit('playerJoined', {
        player: {
          id: player.id,
          username: player.username,
          level: player.level,
          avatar: player.avatar
        },
        roomInfo: this.getPublicInfo(),
        totalPlayers: this.players.size
      });

      // Auto-start game when we have enough players
      if (this.players.size >= 2 && this.status === 'waiting') {
        setTimeout(() => this.startGame(), 3000); // 3 second delay
      }

      return player;
    }

    removePlayer(playerId, reason = 'left') {
      const player = this.players.get(playerId);
      if (!player) return false;

      // Remove from engine
      this.engine.removePlayer?.(playerId);
      
      // Remove from room
      this.players.delete(playerId);
      this.playerOrder = this.playerOrder.filter(id => id !== playerId);

      // Notify other players
      io.to(this.id).emit('playerLeft', {
        playerId,
        username: player.username,
        reason,
        remainingPlayers: this.players.size
      });

      // Handle game interruption
      if (this.status === 'active' && this.players.size < 2) {
        this.endGame('insufficient_players');
      }

      return true;
    }

    addSpectator(socket, userData) {
      this.spectatorSockets.add(socket.id);
      socket.join(this.id);
      
      socket.emit('spectatorJoined', {
        room: this.id,
        gameState: this.getGameStateForSpectator(),
        chatHistory: this.chatHistory.slice(-20) // Last 20 messages
      });

      // Notify about new spectator
      io.to(this.id).emit('spectatorUpdate', {
        spectatorCount: this.spectatorSockets.size
      });
    }

    // Game flow methods
    startGame() {
      if (this.status !== 'waiting' || this.players.size < 2) {
        return false;
      }

      this.status = 'starting';
      this.gameStartTime = Date.now();

      try {
        // Initialize game engine
        const gameState = this.engine.startGame();
        this.status = 'active';

        // Deduct entry points from all players
        this.players.forEach(async (player) => {
          await User.findByIdAndUpdate(player.id, {
            $inc: { points: -this.betAmount }
          });
        });

        // Broadcast game start
        io.to(this.id).emit('gameStarted', {
          gameState: this.getGameState(),
          message: 'Game started! Good luck!',
          betAmount: this.betAmount
        });

        // Add system message to chat
        this.addChatMessage('system', 'Game started! Good luck everyone!', 'system');

        return true;
      } catch (error) {
        console.error('Error starting game:', error);
        this.status = 'waiting';
        io.to(this.id).emit('gameError', {
          message: 'Failed to start game. Please try again.'
        });
        return false;
      }
    }

    playCard(playerId, cardIndex) {
      if (this.status !== 'active') {
        throw new Error('Game not active');
      }

      try {
        const result = this.engine.playCard(playerId, cardIndex);
        const player = this.players.get(playerId);
        
        if (player) {
          player.stats.cardsPlayed++;
        }

        // Broadcast card played
        const card = this.engine.getPlayerHand(playerId)[cardIndex] || this.engine.getTopCard();
        io.to(this.id).emit('cardPlayed', {
          playerId,
          username: player?.username,
          card,
          topCard: this.engine.getTopCard(),
          gameState: this.getGameState()
        });

        // Check for game end
        if (result.gameOver) {
          this.endGame(result.winner);
        }

        return result;
      } catch (error) {
        throw error;
      }
    }

    drawCard(playerId) {
      if (this.status !== 'active') {
        throw new Error('Game not active');
      }

      try {
        const result = this.engine.drawCard(playerId);
        const player = this.players.get(playerId);
        
        if (player) {
          player.stats.cardsDrawn++;
        }

        // Broadcast card draw
        io.to(this.id).emit('cardDrawn', {
          playerId,
          username: player?.username,
          gameState: this.getGameState()
        });

        return result;
      } catch (error) {
        throw error;
      }
    }

    callMatatu(playerId) {
      const player = this.players.get(playerId);
      if (!player) return false;

      const result = this.engine.callMatatu(playerId);
      if (result) {
        player.stats.matatuCalls++;
        
        io.to(this.id).emit('matatuCalled', {
          playerId,
          username: player.username,
          message: `${player.username} called MATATU!`
        });

        this.addChatMessage('system', `${player.username} called MATATU!`, 'system');
      }

      return result;
    }

    async endGame(winnerId) {
      if (this.status === 'completed') return;

      this.status = 'completed';
      this.winner = winnerId;
      const gameEndTime = Date.now();
      const gameDuration = gameEndTime - this.gameStartTime;

      try {
        // Calculate game results
        this.gameResults = this.engine.calculateGameResults();
        
        // Update player statistics and points
        const updatePromises = [];
        const playerUpdates = [];

        this.players.forEach((player, playerId) => {
          const isWinner = playerId === winnerId;
          const playerResult = this.gameResults.players.find(p => p.id === playerId);
          
          if (playerResult) {
            // Prepare database update
            const updateData = {
              $inc: {
                gamesPlayed: 1,
                points: playerResult.pointsChange
              }
            };

            if (isWinner) {
              updateData.$inc.gamesWon = 1;
            }

            updatePromises.push(
              User.findByIdAndUpdate(playerId, updateData, { new: true })
            );

            playerUpdates.push({
              playerId,
              username: player.username,
              isWinner,
              pointsChange: playerResult.pointsChange,
              newPoints: player.points + playerResult.pointsChange,
              cardsRemaining: playerResult.cardsRemaining
            });
          }
        });

        // Execute database updates
        const updatedUsers = await Promise.all(updatePromises);

        // Check for achievements
        for (let i = 0; i < updatedUsers.length; i++) {
          const user = updatedUsers[i];
          if (user) {
            const achievements = await AchievementSystem.checkAndAwardAchievements(
              user._id, 
              {
                gameWon: user._id.toString() === winnerId,
                gameDuration: gameDuration / 1000,
                gameType: this.gameType
              }
            );

            if (achievements.length > 0) {
              // Notify player of new achievements
              const playerSocket = Array.from(io.sockets.sockets.values())
                .find(s => connectedUsers.get(s.id)?.id === user._id.toString());
              
              if (playerSocket) {
                playerSocket.emit('achievementsUnlocked', { achievements });
              }
            }
          }
        }

        // Save game record
        const gameRecord = new Game({
          room: this.id,
          players: playerUpdates.map(p => ({
            userId: p.playerId,
            username: p.username,
            position: p.isWinner ? 1 : 2,
            pointsWon: Math.max(0, p.pointsChange),
            pointsLost: Math.abs(Math.min(0, p.pointsChange)),
            finalHand: [], // Would store actual final hand
            stats: this.players.get(p.playerId)?.stats
          })),
          winner: winnerId,
          gameMode: this.gameType,
          betAmount: this.betAmount,
          duration: Math.floor(gameDuration / 1000),
          tournamentId: this.tournamentId,
          endedAt: new Date()
        });

        await gameRecord.save();

        // Broadcast game over
        const winnerName = this.players.get(winnerId)?.username || 'Unknown';
        io.to(this.id).emit('gameOver', {
          winner: winnerName,
          winnerId,
          duration: gameDuration,
          results: playerUpdates,
          gameStats: {
            totalMoves: this.gameResults.totalMoves || 0,
            longestTurn: this.gameResults.longestTurn || 0
          }
        });

        // Clean up room after delay
        setTimeout(() => {
          activeRooms.delete(this.id);
        }, 30000); // Keep room for 30 seconds for final messages

        // Tournament handling
        if (this.tournamentId) {
          await this.handleTournamentGameEnd(winnerId);
        }

      } catch (error) {
        console.error('Error ending game:', error);
        io.to(this.id).emit('gameError', {
          message: 'Error ending game. Please contact support.'
        });
      }
    }

    async handleTournamentGameEnd(winnerId) {
      try {
        const tournament = await Tournament.findById(this.tournamentId);
        if (!tournament) return;

        // Update tournament bracket
        // This would contain complex bracket advancement logic
        // For now, simplified version:
        
        // Find the match in current round
        const currentRound = tournament.rounds[tournament.rounds.length - 1];
        if (currentRound) {
          const match = currentRound.matches.find(m => 
            m.player1.toString() === this.players.keys().next().value ||
            m.player2.toString() === this.players.keys().next().value
          );
          
          if (match) {
            match.winner = winnerId;
            match.status = 'completed';
            match.completedAt = new Date();
            match.gameId = this.gameResults?.gameId;
            
            await tournament.save();
            
            // Notify tournament participants
            io.emit('tournamentUpdate', {
              tournamentId: this.tournamentId,
              matchResult: {
                matchId: match.matchId,
                winner: winnerId,
                winnerName: this.players.get(winnerId)?.username
              }
            });
          }
        }
      } catch (error) {
        console.error('Error handling tournament game end:', error);
      }
    }

    // Chat methods
    addChatMessage(username, message, type = 'player') {
      const chatMessage = {
        id: Date.now() + Math.random(),
        username,
        message,
        type, // 'player', 'system', 'admin'
        timestamp: Date.now()
      };

      this.chatHistory.push(chatMessage);

      // Keep only last N messages
      if (this.chatHistory.length > this.maxChatHistory) {
        this.chatHistory = this.chatHistory.slice(-this.maxChatHistory);
      }

      // Broadcast to room
      io.to(this.id).emit('chatMessage', chatMessage);

      return chatMessage;
    }

    // State methods
    getGameState() {
      const engineState = this.engine.getGameState();
      
      return {
        ...engineState,
        room: this.id,
        roomName: this.name,
        gameType: this.gameType,
        betAmount: this.betAmount,
        status: this.status,
        spectatorCount: this.spectatorSockets.size,
        chatHistory: this.chatHistory.slice(-10) // Last 10 messages
      };
    }

    getGameStateForPlayer(playerId) {
      const baseState = this.getGameState();
      return {
        ...baseState,
        myHand: this.engine.getPlayerHand(playerId)
      };
    }

    getGameStateForSpectator() {
      const baseState = this.getGameState();
      // Remove sensitive information for spectators
      delete baseState.myHand;
      return baseState;
    }

    getPublicInfo() {
      return {
        id: this.id,
        name: this.name,
        gameType: this.gameType,
        players: this.players.size,
        maxPlayers: this.maxPlayers,
        status: this.status,
        betAmount: this.betAmount,
        isPrivate: this.isPrivate,
        spectatorCount: this.spectatorSockets.size,
        created: this.created
      };
    }
  }

  // Socket connection handler
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Authentication handler
    socket.on('userAuth', async (userData) => {
      try {
        // Verify user data and update online status
        const user = await User.findByIdAndUpdate(
          userData.id,
          { 
            isOnline: true, 
            lastActive: new Date() 
          },
          { new: true }
        );

        if (user) {
          connectedUsers.set(socket.id, {
            id: user._id.toString(),
            username: user.username,
            level: user.level,
            points: user.points,
            avatar: user.avatar,
            socketId: socket.id
          });

          socket.emit('authSuccess', { 
            user: {
              id: user._id,
              username: user.username,
              points: user.points,
              level: user.level,
              gamesPlayed: user.gamesPlayed,
              gamesWon: user.gamesWon,
              winRate: user.winRate
            }
          });

          // Send initial room list
          socket.emit('roomList', Array.from(activeRooms.values())
            .filter(room => !room.isPrivate || room.status === 'waiting')
            .map(room => room.getPublicInfo())
          );
        }
      } catch (error) {
        console.error('Auth error:', error);
        socket.emit('authError', { message: 'Authentication failed' });
      }
    });

    // Quick match handler
    socket.on('quickMatch', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const { skill = 'any', gameType = 'casual' } = data;
      
      try {
        // Add to waiting queue
        const queue = waitingPlayers.get(skill) || waitingPlayers.get('any');
        queue.add({ socket, user, preferences: data });

        socket.emit('matchmaking', { 
          status: 'searching',
          queueSize: queue.size,
          estimatedWait: Math.max(5, queue.size * 10) // seconds
        });

        // Try to match players
        if (queue.size >= 2) {
          const players = Array.from(queue).slice(0, 4);
          queue.clear();

          // Create new game room
          const roomId = `quick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const room = new GameRoom(roomId, {
            name: 'Quick Match',
            gameType,
            betAmount: 100,
            maxPlayers: Math.min(4, players.length + 1)
          });

          activeRooms.set(roomId, room);

          // Add all matched players to room
          for (const playerData of players) {
            try {
              const player = room.addPlayer(playerData.socket, playerData.user);
              playerData.socket.emit('roomJoined', {
                room: roomId,
                gameState: room.getGameStateForPlayer(player.id)
              });
            } catch (error) {
              console.error('Error adding player to quick match:', error);
              playerData.socket.emit('matchmakingError', { 
                message: 'Failed to join match' 
              });
            }
          }

          // Update room list for all connected users
          io.emit('roomListUpdate', Array.from(activeRooms.values())
            .filter(r => !r.isPrivate)
            .map(r => r.getPublicInfo())
          );
        }
      } catch (error) {
        console.error('Quick match error:', error);
        socket.emit('matchmakingError', { 
          message: 'Matchmaking failed. Please try again.' 
        });
      }
    });

    // Create room handler
    socket.on('createRoom', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      try {
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const room = new GameRoom(roomId, {
          name: data.name || `${user.username}'s Room`,
          maxPlayers: data.maxPlayers || 4,
          gameType: data.gameType || 'private',
          betAmount: data.betAmount || 100,
          isPrivate: data.isPrivate !== false
        });

        activeRooms.set(roomId, room);

        // Add creator to room
        const player = room.addPlayer(socket, user);
        socket.emit('roomCreated', {
          room: roomId,
          roomCode: roomId.split('_').pop().toUpperCase(), // Simplified room code
          gameState: room.getGameStateForPlayer(player.id)
        });

        // Update room list
        if (!room.isPrivate) {
          io.emit('roomListUpdate', Array.from(activeRooms.values())
            .filter(r => !r.isPrivate)
            .map(r => r.getPublicInfo())
          );
        }
      } catch (error) {
        console.error('Create room error:', error);
        socket.emit('createRoomError', { 
          message: 'Failed to create room' 
        });
      }
    });

    // Join room handler
    socket.on('joinRoom', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const { roomCode } = data;
      
      try {
        // Find room by code or ID
        let room = null;
        for (const [roomId, roomInstance] of activeRooms) {
          if (roomId === roomCode || 
              roomId.includes(roomCode.toLowerCase()) ||
              roomId.split('_').pop().toUpperCase() === roomCode.toUpperCase()) {
            room = roomInstance;
            break;
          }
        }

        if (!room) {
          socket.emit('joinRoomError', { message: 'Room not found' });
          return;
        }

        const player = room.addPlayer(socket, user);
        socket.emit('roomJoined', {
          room: room.id,
          gameState: room.getGameStateForPlayer(player.id)
        });

      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('joinRoomError', { 
          message: error.message || 'Failed to join room' 
        });
      }
    });

    // Join room by ID handler
    socket.on('joinRoomById', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const { roomId } = data;
      const room = activeRooms.get(roomId);

      if (!room) {
        socket.emit('joinRoomError', { message: 'Room not found' });
        return;
      }

      try {
        if (room.status === 'active') {
          // Join as spectator
          room.addSpectator(socket, user);
        } else {
          // Join as player
          const player = room.addPlayer(socket, user);
          socket.emit('roomJoined', {
            room: roomId,
            gameState: room.getGameStateForPlayer(player.id)
          });
        }
      } catch (error) {
        socket.emit('joinRoomError', { message: error.message });
      }
    });

    // Game action handlers
    socket.on('playCard', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const { room: roomId, cardIndex } = data;
      const room = activeRooms.get(roomId);

      if (!room) {
        socket.emit('playCardError', { message: 'Room not found' });
        return;
      }

      try {
        const result = room.playCard(user.id, cardIndex);
        socket.emit('playCardSuccess', result);
      } catch (error) {
        socket.emit('playCardError', { message: error.message });
      }
    });

    socket.on('drawCard', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const { room: roomId } = data;
      const room = activeRooms.get(roomId);

      if (!room) {
        socket.emit('drawCardError', { message: 'Room not found' });
        return;
      }

      try {
        const result = room.drawCard(user.id);
        socket.emit('drawCardSuccess', result);
      } catch (error) {
        socket.emit('drawCardError', { message: error.message });
      }
    });

    socket.on('callMatatu', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const { room: roomId } = data;
      const room = activeRooms.get(roomId);

      if (room) {
        const result = room.callMatatu(user.id);
        socket.emit('matatuCallResult', { success: result });
      }
    });

    socket.on('leaveGame', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const { room: roomId } = data;
      const room = activeRooms.get(roomId);

      if (room) {
        room.removePlayer(user.id, 'left');
        socket.leave(roomId);
        socket.emit('gameLeft', { room: roomId });
      }
    });

    // Chat handler
    socket.on('chatMessage', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      const { room: roomId, message } = data;
      const room = activeRooms.get(roomId);

      if (room && message && message.trim().length > 0) {
        // Filter inappropriate content (basic implementation)
        const cleanMessage = message.replace(/[<>]/g, '').trim();
        if (cleanMessage.length > 0 && cleanMessage.length <= 200) {
          room.addChatMessage(user.username, cleanMessage, 'player');
        }
      }
    });

    // Room list request
    socket.on('getRooms', () => {
      socket.emit('roomList', Array.from(activeRooms.values())
        .filter(room => !room.isPrivate || room.status === 'waiting')
        .map(room => room.getPublicInfo())
      );
    });

    // Tournament handlers
    socket.on('getTournaments', async () => {
      try {
        const tournaments = await Tournament.find({
          status: { $in: ['upcoming', 'registration', 'ongoing'] }
        })
        .populate('participants.userId', 'username level avatar')
        .sort({ registrationStart: 1 })
        .limit(10);

        socket.emit('tournamentList', tournaments);
      } catch (error) {
        socket.emit('tournamentError', { message: 'Failed to load tournaments' });
      }
    });

    socket.on('joinTournament', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      try {
        const tournament = await Tournament.findById(data.tournamentId);
        if (!tournament) {
          socket.emit('tournamentJoinError', { message: 'Tournament not found' });
          return;
        }

        await tournament.addParticipant(user.id, user.username);
        await tournament.save();

        // Deduct entry fee
        await User.findByIdAndUpdate(user.id, {
          $inc: { points: -tournament.entryFee }
        });

        socket.emit('tournamentJoinSuccess', {
          tournament: tournament.name,
          participants: tournament.participants.length
        });

        // Broadcast tournament update
        io.emit('tournamentUpdate', {
          tournamentId: tournament._id,
          participants: tournament.participants.length,
          prizePool: tournament.prizePool
        });

      } catch (error) {
        socket.emit('tournamentJoinError', { 
          message: error.message || 'Failed to join tournament' 
        });
      }
    });

    // Analytics and leaderboard
    socket.on('getLeaderboard', async (data) => {
      try {
        const { period = 'all', limit = 20 } = data;
        
        let dateFilter = {};
        if (period === 'week') {
          dateFilter = { lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
        } else if (period === 'month') {
          dateFilter = { lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
        }

        const leaderboard = await User.find(dateFilter)
          .select('username points gamesWon gamesPlayed winRate level avatar country')
          .sort({ points: -1, winRate: -1 })
          .limit(limit);

        socket.emit('leaderboard', leaderboard.map((user, index) => ({
          rank: index + 1,
          id: user._id,
          username: user.username,
          points: user.points,
          gamesWon: user.gamesWon,
          gamesPlayed: user.gamesPlayed,
          winRate: user.winRate,
          level: user.level,
          avatar: user.avatar,
          country: user.country
        })));

      } catch (error) {
        socket.emit('leaderboardError', { message: 'Failed to load leaderboard' });
      }
    });

    socket.on('getPlayerStats', async (data) => {
      const user = connectedUsers.get(socket.id);
      if (!user) return;

      try {
        const stats = await GameAnalytics.getPlayerPerformance(user.id, data.period);
        const gameModeStats = await GameAnalytics.getGameModeStats(user.id, data.period);
        const performanceTrend = await GameAnalytics.getPerformanceTrend(user.id, data.period);

        socket.emit('playerStats', {
          overall: stats,
          byGameMode: gameModeStats,
          trend: performanceTrend
        });

      } catch (error) {
        socket.emit('statsError', { message: 'Failed to load statistics' });
      }
    });

    // Disconnect handler
    socket.on('disconnect', async (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      
      const user = connectedUsers.get(socket.id);
      if (user) {
        // Update user offline status
        try {
          await User.findByIdAndUpdate(user.id, {
            isOnline: false,
            lastActive: new Date()
          });
        } catch (error) {
          console.error('Error updating user offline status:', error);
        }

        // Remove from waiting queues
        waitingPlayers.forEach(queue => {
          queue.forEach(playerData => {
            if (playerData.socket.id === socket.id) {
              queue.delete(playerData);
            }
          });
        });

        // Handle room disconnections
        activeRooms.forEach(room => {
          if (room.players.has(user.id)) {
            const player = room.players.get(user.id);
            player.connected = false;
            
            // Give player 30 seconds to reconnect
            setTimeout(() => {
              if (room.players.has(user.id) && !room.players.get(user.id).connected) {
                room.removePlayer(user.id, 'disconnected');
              }
            }, 30000);
          }

          if (room.spectatorSockets.has(socket.id)) {
            room.spectatorSockets.delete(socket.id);
            io.to(room.id).emit('spectatorUpdate', {
              spectatorCount: room.spectatorSockets.size
            });
          }
        });

        connectedUsers.delete(socket.id);
      }
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Periodic cleanup and maintenance
  setInterval(() => {
    const now = Date.now();
    
    // Clean up empty or old rooms
    activeRooms.forEach((room, roomId) => {
      if (room.players.size === 0 && (now - room.created) > 300000) { // 5 minutes
        activeRooms.delete(roomId);
      }
    });

    // Clean up waiting players
    waitingPlayers.forEach(queue => {
      queue.forEach(playerData => {
        if (!playerData.socket.connected) {
          queue.delete(playerData);
        }
      });
    });

    // Broadcast server statistics
    io.emit('serverStats', {
      activeRooms: activeRooms.size,
      connectedUsers: connectedUsers.size,
      activeGames: Array.from(activeRooms.values()).filter(r => r.status === 'active').length
    });

  }, 60000); // Every minute

  return {
    activeRooms,
    connectedUsers,
    waitingPlayers
  };
};