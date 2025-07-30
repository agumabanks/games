
#!/bin/bash

# MongoDB Connection Error Fix Script
# Fixes: "option buffermaxentries is not supported"

echo "🔧 MONGODB CONNECTION REPAIR UTILITY"
echo "====================================="

# Fix 1: Update db.js configuration
if [ -f "backend/config/db.js" ]; then
    echo "📝 Updating MongoDB connection configuration..."
    
    cat > backend/config/db.js << 'EOF'
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Remove all deprecated options - they're now defaults in Mongoose 6+
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

  } catch (error) {
    console.error('💥 Database connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
EOF
    
    echo "✅ MongoDB configuration updated successfully"
else
    echo "❌ backend/config/db.js not found"
    exit 1
fi

# Fix 2: Ensure MongoDB is running
echo "🔍 Checking MongoDB status..."

if command -v mongosh >/dev/null 2>&1; then
    if mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
        echo "✅ MongoDB is running and accessible"
    else
        echo "⚠️  MongoDB not responding, attempting to start..."
        
        # Try systemctl
        if command -v systemctl >/dev/null 2>&1; then
            echo "🔄 Starting MongoDB service..."
            sudo systemctl start mongod
            sleep 3
            
            if mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
                echo "✅ MongoDB started successfully"
            else
                echo "❌ Failed to start MongoDB via systemctl"
            fi
        fi
        
        # Try Docker as fallback
        if command -v docker >/dev/null 2>&1; then
            echo "🐳 Starting MongoDB via Docker..."
            docker run -d --name matatu-mongodb -p 27017:27017 mongo:latest
            sleep 5
            
            if mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
                echo "✅ MongoDB Docker container started successfully"
            else
                echo "❌ Failed to start MongoDB via Docker"
            fi
        fi
    fi
else
    echo "📦 Installing MongoDB tools..."
    # Install mongosh if available
    if command -v npm >/dev/null 2>&1; then
        npm install -g mongosh
    fi
fi

echo ""
echo "🎯 Connection repair complete!"
echo "You can now run the system verifier: ./system-ai-verifier.sh"