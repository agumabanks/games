/* eslint-disable no-undef */
const socket = io('http://localhost:5000');
let currentRoom = null;
let myHand = [];

// helpers
const $ = id => document.getElementById(id);

function renderHand() {
  const handDiv = $('hand');
  handDiv.innerHTML = '';
  myHand.forEach(card => {
    const el = document.createElement('span');
    el.className = 'card';
    el.textContent = card;
    el.onclick = () => playCard(card);
    handDiv.appendChild(el);
  });
}

function appendChat(text) {
  const div = document.createElement('div');
  div.textContent = text;
  $('chatBox').appendChild(div);
  $('chatBox').scrollTop = $('chatBox').scrollHeight;
}

/* ---------- Socket listeners ---------- */
socket.on('playerJoined', () => appendChat('Opponent joined the room'));
socket.on('cardPlayed', ({ player, card, topCard }) => {
  $('topCard').textContent = topCard;
  if (player !== socket.id) appendChat(`Opponent played ${card}`);
});
socket.on('chat', ({ player, message }) => {
  appendChat((player === socket.id ? 'Me' : 'Opponent') + ': ' + message);
});
socket.on('gameOver', ({ winner }) => {
  alert(winner === socket.id ? 'You win!' : 'You lose!');
  location.reload();
});

/* ---------- Lobby actions ---------- */
function createRoom() {
  socket.emit('createRoom', { username: 'Player' }, ({ room, hand, topCard }) =>
    startGame(room, hand, topCard)
  );
}

function joinRoom() {
  const room = $('roomCode').value.trim();
  socket.emit('joinRoom', { room, username: 'Player' }, ({ error, hand, topCard }) => {
    if (error) return alert(error);
    startGame(room, hand, topCard);
  });
}

function startGame(room, hand, topCard) {
  currentRoom = room;
  myHand = hand;
  $('lobby').classList.add('hidden');
  $('game').classList.remove('hidden');
  $('roomLabel').textContent = 'Room ' + room;
  $('topCard').textContent = topCard;
  renderHand();
}

/* ---------- In-game actions ---------- */
function playCard(card) {
  socket.emit('playCard', { room: currentRoom, card }, ({ error }) => {
    if (error) return alert(error);
    myHand = myHand.filter(c => c !== card);
    renderHand();
  });
}

function drawCard() {
  socket.emit('drawCard', { room: currentRoom }, ({ error, card }) => {
    if (error) return alert(error);
    myHand.push(card);
    renderHand();
  });
}

function sendChat() {
  const msg = $('chatInput').value.trim();
  if (!msg) return;
  socket.emit('chat', { room: currentRoom, message: msg });
  $('chatInput').value = '';
}
