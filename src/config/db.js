const mongoose = require('mongoose');
const config = require('./index');

const connectDB = async () => {
  if (!config.mongoUri) {
    console.error('MONGODB_URI missing in .env');
    process.exit(1);
  }
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
