const mongoose = require('mongoose');
require('dotenv').config();

async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database connected successfully');
    
    const db = mongoose.connection.db;
    
    // Create collections
    const collections = ['users', 'games', 'tournaments'];
    for (const collection of collections) {
      try {
        await db.createCollection(collection);
        console.log(`✅ Collection '${collection}' ready`);
      } catch (error) {
        if (error.codeName === 'NamespaceExists') {
          console.log(`✅ Collection '${collection}' already exists`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('🎉 Database initialization complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initializeDatabase();
