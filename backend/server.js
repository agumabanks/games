// backend/server.js
const express  = require('express');
const http     = require('http');
const socketio = require('socket.io');
const cors     = require('cors');
const dotenv   = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// REST endpoints
app.get('/', (_, res) => res.send('Matatu API running'));
app.use('/api/auth', require('./routes/auth'));

// Realtime (Socket.IO)
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: '*' } });
require('./sockets/gameHandler')(io);

// Launch
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));



