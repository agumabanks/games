// backend/config/db.js - Enhanced Database Connection
const mongoose = require('mongoose');
const winston = require('winston');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
    });

    winston.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // Setup connection event handlers
    mongoose.connection.on('error', (err) => {
      winston.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      winston.warn('MongoDB disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      process.exit(0);
    });

  } catch (error) {
    winston.error('Database connection failed:', error);
    process.exit(1);
  }
};

module.exports = connectDB;