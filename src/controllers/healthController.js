const mongoose = require('mongoose');

const check = async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbConnected = dbState === 1;

  res.json({
    success: true,
    message: 'Server is running',
    service: 'spacetime-api',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbConnected,
      status: dbConnected ? 'connected' : 'disconnected',
    },
  });
};

module.exports = { check };
