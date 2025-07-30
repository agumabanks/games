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
