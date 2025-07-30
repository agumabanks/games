const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const applySecurity = require('./middleware/security');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const connectDB = require('./config/db');

connectDB();

const app = express();

// Apply security-related middleware such as Helmet and rate limiting
applySecurity(app);
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/games', require('./routes/games'));
app.use('/api/tournaments', require('./routes/tournaments'));

// Serve frontend for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message
  });
});

// 404 handler - serve frontend for non-API routes
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

const server = http.createServer(app);

const io = socketio(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const gracefulShutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('HTTP server closed');
    const mongoose = require('mongoose');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('🎮 MATATU ONLINE SERVER STARTED!');
  console.log('=====================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log('=====================================');
});

module.exports = server;