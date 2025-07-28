const { createDeck, deal, validMove } = require('../utils/gameEngine');
const Game = require('../models/Game');
const User = require('../models/User');

module.exports = (io) => {
  const rooms = {}; // room => { deck, piles, hands, turn }

  io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);

    socket.on('createRoom', async ({ username }, cb) => {
      const room = 'room-' + socket.id.slice(0,5);
      socket.join(room);

      const deck = createDeck();
      const [hand1, hand2] = deal(deck);
      const topCard = deck.pop();

      rooms[room] = {
        deck, hands: { [socket.id]: hand1 }, topCard, turn: socket.id
      };

      cb({ room, hand: hand1, topCard });
    });

    socket.on('joinRoom', ({ room, username }, cb) => {
      if (!rooms[room]) return cb({ error: 'Room not found' });
      const data = rooms[room];
      if (Object.keys(data.hands).length >= 2) return cb({ error: 'Room full' });

      data.hands[socket.id] = data.deck.splice(0,5);
      socket.join(room);
      io.to(room).emit('playerJoined', username);

      cb({ room, hand: data.hands[socket.id], topCard: data.topCard });
    });

    socket.on('playCard', ({ room, card }, cb) => {
      const game = rooms[room];
      if (!game) return;

      if (socket.id !== game.turn) return cb({ error: 'Not your turn' });
      const hand = game.hands[socket.id];
      if (!hand.includes(card)) return cb({ error: 'You do not have that card' });
      if (!validMove(card, game.topCard)) return cb({ error: 'Invalid move' });

      // play
      hand.splice(hand.indexOf(card),1);
      game.topCard = card;
      game.turn = Object.keys(game.hands).find(id => id !== socket.id);

      io.to(room).emit('cardPlayed', { player: socket.id, card, topCard: game.topCard });

      // check win
      if (hand.length === 0) {
        io.to(room).emit('gameOver', { winner: socket.id });
        delete rooms[room];
      }
    });

    socket.on('drawCard', ({ room }, cb) => {
      const game = rooms[room];
      if (!game) return;
      if (game.deck.length === 0) return cb({ error: 'Deck empty' });
      const card = game.deck.pop();
      game.hands[socket.id].push(card);
      cb({ card });
    });

    socket.on('chat', ({ room, message }) => {
      io.to(room).emit('chat', { player: socket.id, message });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnect', socket.id);
    });
  });
};
