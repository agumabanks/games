// backend/routes/soko24.js - Soko 24 Marketplace Integration
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

// Multer configuration for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get featured products for game integration
router.get('/featured', async (req, res) => {
  try {
    const featuredProducts = await Product.find({
      featuredInGame: true,
      isActive: true,
      stock: { $gt: 0 }
    })
    .populate('vendor.id', 'username soko24.shopName soko24.rating')
    .sort({ sold: -1 })
    .limit(10);

    res.json({
      success: true,
      products: featuredProducts.map(product => ({
        id: product._id,
        name: product.name,
        description: product.description.substring(0, 100) + '...',
        price: product.price,
        discountPrice: product.discountPrice,
        image: product.images[0] || '/default-product.jpg',
        vendor: product.vendor.name,
        rating: product.vendor.id?.soko24?.rating || 5.0,
        promoCode: product.promoCode,
        gameReward: product.gameReward
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching featured products'
    });
  }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 12, sort = 'sold', minPrice, maxPrice } = req.query;

    let filter = {
      category,
      isActive: true,
      stock: { $gt: 0 }
    };

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const sortOptions = {
      'sold': { sold: -1 },
      'price-asc': { price: 1 },
      'price-desc': { price: -1 },
      'newest': { createdAt: -1 },
      'rating': { 'vendor.rating': -1 }
    };

    const products = await Product.find(filter)
      .populate('vendor.id', 'username soko24.shopName soko24.rating')
      .sort(sortOptions[sort] || { sold: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products'
    });
  }
});

// Search products
router.get('/search', async (req, res) => {
  try {
    const { q, category, page = 1, limit = 12 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, products: [], pagination: { total: 0 } });
    }

    let filter = {
      isActive: true,
      stock: { $gt: 0 },
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };

    if (category && category !== 'all') {
      filter.category = category;
    }

    const products = await Product.find(filter)
      .populate('vendor.id', 'username soko24.shopName soko24.rating')
      .sort({ sold: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching products'
    });
  }
});

// Get single product details
router.get('/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('vendor.id', 'username soko24.shopName soko24.rating bio country');

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get related products
    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: true,
      stock: { $gt: 0 }
    })
    .limit(4)
    .select('name price discountPrice images vendor');

    res.json({
      success: true,
      product,
      relatedProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching product details'
    });
  }
});

// Add product (vendor only)
router.post('/product', protect, upload.array('images', 5), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      discountPrice,
      category,
      tags,
      specifications,
      stock,
      promoCode
    } = req.body;

    // Check if user is a vendor
    const user = await User.findById(req.user.id);
    if (!user.soko24.isVendor) {
      return res.status(403).json({
        success: false,
        message: 'Only vendors can add products'
      });
    }

    // Process uploaded images
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Optimize and save image
        const filename = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webp`;
        const outputPath = path.join(__dirname, '../public/uploads', filename);
        
        await sharp(file.buffer)
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(outputPath);

        imageUrls.push(`/uploads/${filename}`);
      }
    }

    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      category,
      images: imageUrls,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      specifications: specifications ? JSON.parse(specifications) : [],
      stock: parseInt(stock),
      promoCode,
      vendor: {
        id: user._id,
        name: user.soko24.shopName || user.username,
        rating: user.soko24.rating
      }
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding product'
    });
  }
});

// Game reward redemption
router.post('/redeem-reward', protect, async (req, res) => {
  try {
    const { productId } = req.body;
    const user = await User.findById(req.user.id);
    
    const product = await Product.findById(productId);
    if (!product || !product.gameReward.isGameReward) {
      return res.status(404).json({
        success: false,
        message: 'Reward product not found'
      });
    }

    if (user.points < product.gameReward.pointsRequired) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient points for this reward'
      });
    }

    if (product.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Reward is out of stock'
      });
    }

    // Create order for reward redemption
    const order = new Order({
      user: user._id,
      items: [{
        product: product._id,
        quantity: 1,
        priceAtTime: 0, // Free reward
        pointsUsed: product.gameReward.pointsRequired
      }],
      totalAmount: 0,
      pointsUsed: product.gameReward.pointsRequired,
      orderType: 'reward_redemption',
      status: 'confirmed',
      shippingAddress: user.address || {
        phone: '',
        address: 'To be provided',
        city: user.country || 'Kenya'
      }
    });

    await order.save();

    // Deduct points and update stock
    await User.findByIdAndUpdate(user._id, {
      $inc: { points: -product.gameReward.pointsRequired }
    });

    await Product.findByIdAndUpdate(productId, {
      $inc: { stock: -1, sold: 1 }
    });

    res.json({
      success: true,
      message: 'Reward redeemed successfully!',
      order: order._id,
      remainingPoints: user.points - product.gameReward.pointsRequired
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error redeeming reward'
    });
  }
});

// Become a vendor
router.post('/become-vendor', protect, async (req, res) => {
  try {
    const { shopName, description, phone, businessType } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        'soko24.isVendor': true,
        'soko24.shopName': shopName,
        'soko24.businessType': businessType,
        'soko24.description': description,
        'soko24.phone': phone,
        'soko24.joinedAt': new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Congratulations! You are now a Soko 24 vendor.',
      user: {
        id: user._id,
        username: user.username,
        soko24: user.soko24
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error becoming vendor'
    });
  }
});

// Get vendor dashboard data
router.get('/vendor/dashboard', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.soko24.isVendor) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Vendor only.'
      });
    }

    const products = await Product.find({ 'vendor.id': user._id });
    const orders = await Order.find({ 'items.product': { $in: products.map(p => p._id) } })
      .populate('user', 'username')
      .sort({ createdAt: -1 })
      .limit(10);

    const stats = {
      totalProducts: products.length,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      averageRating: user.soko24.rating
    };

    res.json({
      success: true,
      stats,
      products: products.slice(0, 5), // Latest 5 products
      orders: orders.slice(0, 5) // Latest 5 orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor dashboard'
    });
  }
});

module.exports = router;

// models/Order.js - Order Management for Soko 24
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    priceAtTime: {
      type: Number,
      required: true,
      min: 0
    },
    pointsUsed: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  pointsUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  
  paymentMethod: {
    type: String,
    enum: ['mpesa', 'card', 'points', 'mixed'],
    default: 'mpesa'
  },
  
  orderType: {
    type: String,
    enum: ['purchase', 'reward_redemption', 'tournament_prize'],
    default: 'purchase'
  },
  
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  shippingAddress: {
    name: String,
    phone: String,
    address: String,
    city: String,
    county: String,
    postalCode: String
  },
  
  paymentDetails: {
    transactionId: String,
    mpesaCode: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    }
  },
  
  tracking: {
    trackingNumber: String,
    carrier: String,
    estimatedDelivery: Date,
    deliveredAt: Date
  },
  
  notes: String,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
OrderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', OrderSchema);

// utils/socketIntegration.js - Socket.IO Integration for Soko 24
const Product = require('../models/Product');

class Soko24Integration {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      
      // Handle Soko 24 specific events
      socket.on('soko24:getFeaturedProducts', async () => {
        try {
          const products = await Product.find({
            featuredInGame: true,
            isActive: true,
            stock: { $gt: 0 }
          }).limit(6);
          
          socket.emit('soko24:featuredProducts', products);
        } catch (error) {
          socket.emit('soko24:error', { message: 'Failed to load featured products' });
        }
      });

      socket.on('soko24:getGameRewards', async (data) => {
        try {
          const { userPoints } = data;
          
          const rewards = await Product.find({
            'gameReward.isGameReward': true,
            'gameReward.pointsRequired': { $lte: userPoints },
            isActive: true,
            stock: { $gt: 0 }
          }).sort({ 'gameReward.pointsRequired': 1 });
          
          socket.emit('soko24:gameRewards', rewards);
        } catch (error) {
          socket.emit('soko24:error', { message: 'Failed to load rewards' });
        }
      });

      socket.on('soko24:trackOrder', async (data) => {
        try {
          const order = await Order.findById(data.orderId)
            .populate('items.product', 'name images')
            .populate('user', 'username');
          
          if (order) {
            socket.emit('soko24:orderStatus', order);
          }
        } catch (error) {
          socket.emit('soko24:error', { message: 'Failed to track order' });
        }
      });
    });
  }

  // Send promotional notifications to game players
  async sendPromotion(promotion) {
    this.io.emit('soko24:promotion', {
      title: promotion.title,
      description: promotion.description,
      discount: promotion.discount,
      products: promotion.products,
      validUntil: promotion.validUntil
    });
  }

  // Notify users about new rewards based on their points
  async notifyEligibleUsers(product) {
    if (product.gameReward.isGameReward) {
      // Find users with enough points
      const eligibleUsers = await User.find({
        points: { $gte: product.gameReward.pointsRequired },
        isOnline: true
      });

      eligibleUsers.forEach(user => {
        // Find user's socket and send notification
        const userSocket = this.findUserSocket(user._id);
        if (userSocket) {
          userSocket.emit('soko24:newRewardAvailable', {
            product: {
              id: product._id,
              name: product.name,
              pointsRequired: product.gameReward.pointsRequired,
              image: product.images[0]
            }
          });
        }
      });
    }
  }

  findUserSocket(userId) {
    // Implementation to find user's socket connection
    // This would depend on how you're tracking connected users
    for (const [socketId, socket] of this.io.sockets.sockets) {
      if (socket.userId === userId.toString()) {
        return socket;
      }
    }
    return null;
  }
}

module.exports = Soko24Integration;

// Updated server.js - Main Server with Soko 24 Integration
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import configurations and utilities
const connectDB = require('./config/db');
const gameHandler = require('./sockets/gameHandler');
const Soko24Integration = require('./utils/socketIntegration');

// Connect to database
connectDB();

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdn.socket.io", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login requests per windowMs
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// General middleware
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.CLIENT_URL] 
    : ['http://localhost:3000', 'http://localhost:5000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Static files
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/games', require('./routes/games'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/soko24', require('./routes/soko24'));

// Serve frontend
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate field value'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Create HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = socketio(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.CLIENT_URL]
      : ['http://localhost:3000', 'http://localhost:5000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Initialize game handler and Soko 24 integration
const gameHandlerInstance = gameHandler(io);
const soko24Integration = new Soko24Integration(io);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('🚀 Matatu Online Server Started!');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🎮 Game rooms active: ${gameHandlerInstance.activeRooms.size}`);
  console.log(`👥 Connected users: ${gameHandlerInstance.connectedUsers.size}`);
  console.log(`🛍️ Soko 24 integration: Active`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
    console.log(`📱 Mobile URL: http://192.168.1.xxx:${PORT}`);
  }
});

module.exports = server;

// ecosystem.config.js - PM2 Production Configuration
module.exports = {
  apps: [{
    name: 'matatu-online',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    
    // Environment variables
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    
    // Logging
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Performance
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    
    // Restart configuration
    kill_timeout: 5000,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_path: '/health',
    
    // Watch files in development
    watch: process.env.NODE_ENV === 'development',
    ignore_watch: ['node_modules', 'logs', 'uploads']
  }],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/matatu-online.git',
      path: '/var/www/matatu-online',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};

// scripts/deploy.sh - Production Deployment Script
#!/bin/bash

# Matatu Online Production Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

set -e  # Exit on any error

ENVIRONMENT=${1:-staging}
PROJECT_NAME="matatu-online"
BUILD_DIR="dist"

echo "🚀 Starting deployment to $ENVIRONMENT..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment is valid
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { log_error "npm is required but not installed."; exit 1; }
command -v pm2 >/dev/null 2>&1 || { log_error "PM2 is required but not installed."; exit 1; }

# Check Node.js version
NODE_VERSION=$(node --version)
log_info "Node.js version: $NODE_VERSION"

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    log_error "package.json not found. Are you in the project root?"
    exit 1
fi

# Check Git status
if [[ -n $(git status --porcelain) ]]; then
    log_warn "Working directory is not clean. Uncommitted changes detected."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
log_info "Installing dependencies..."
npm ci --only=production

# Run tests
log_info "Running tests..."
npm test || {
    log_error "Tests failed. Deployment aborted."
    exit 1
}

# Build application
log_info "Building application..."
npm run build || {
    log_error "Build failed. Deployment aborted."
    exit 1
}

# Database migrations
log_info "Running database migrations..."
npm run migrate || {
    log_warn "Migration failed, but continuing..."
}

# Create necessary directories
log_info "Creating necessary directories..."
mkdir -p logs
mkdir -p public/uploads
mkdir -p backups

# Set proper permissions
chmod 755 public/uploads
chmod 755 logs

# Environment-specific configurations
if [[ "$ENVIRONMENT" == "production" ]]; then
    log_info "Configuring for production environment..."
    
    # Create production environment file if it doesn't exist
    if [[ ! -f ".env.production" ]]; then
        log_warn "Production environment file not found. Creating template..."
        cat > .env.production << EOF
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://localhost:27017/matatu_production
JWT_SECRET=your-super-secret-jwt-key-change-this
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
CLIENT_URL=https://your-domain.com
EOF
        log_warn "Please update .env.production with your actual values"
    fi
    
    # Copy production environment
    cp .env.production .env
    
else
    log_info "Configuring for staging environment..."
    
    if [[ ! -f ".env.staging" ]]; then
        log_warn "Staging environment file not found. Using development config..."
    else
        cp .env.staging .env
    fi
fi

# Start/Restart application with PM2
log_info "Starting application with PM2..."

if pm2 describe $PROJECT_NAME > /dev/null 2>&1; then
    log_info "Application is already running. Restarting..."
    pm2 restart $PROJECT_NAME --env $ENVIRONMENT
else
    log_info "Starting new application instance..."
    pm2 start ecosystem.config.js --env $ENVIRONMENT
fi

# Save PM2 configuration
pm2 save

# Setup PM2 startup script (only on first deployment)
if [[ ! -f "/etc/systemd/system/pm2-deploy.service" ]]; then
    log_info "Setting up PM2 startup script..."
    pm2 startup systemd -u deploy --hp /home/deploy
fi

# Health check
log_info "Performing health check..."
sleep 5

HEALTH_URL="http://localhost:5000/health"
if command -v curl >/dev/null 2>&1; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
    if [[ "$HTTP_STATUS" == "200" ]]; then
        log_info "Health check passed ✅"
    else
        log_error "Health check failed with status: $HTTP_STATUS"
        exit 1
    fi
else
    log_warn "curl not available. Skipping health check."
fi

# Display application status
log_info "Application status:"
pm2 status $PROJECT_NAME

# Display application logs (last 10 lines)
log_info "Recent application logs:"
pm2 logs $PROJECT_NAME --lines 10 --nostream

# Success message
log_info "🎉 Deployment to $ENVIRONMENT completed successfully!"
log_info "Application is running at: http://localhost:5000"
log_info "Health check endpoint: http://localhost:5000/health"

# Optional: Send deployment notification
if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"🚀 Matatu Online deployed to '$ENVIRONMENT' successfully!"}' \
        "$SLACK_WEBHOOK_URL" || log_warn "Failed to send Slack notification"
fi

echo "Deployment completed at $(date)"