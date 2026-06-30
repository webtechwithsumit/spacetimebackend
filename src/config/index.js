require('dotenv').config();

// ALLOWED_ORIGINS set ho to sirf woh origins; empty = sab allow
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

const baseUrl = process.env.BASE_URL || '';

module.exports = {
  port: process.env.PORT || 3002,
  mongoUri: process.env.MONGODB_URI,
  analyticsEnabled: String(process.env.ANALYTICS_ENABLED ?? "false").toLowerCase() === "true",
  analyticsMongoUri: process.env.ANALYTICS_MONGODB_URI || "",
  allowedOrigins,
  baseUrl,
  jwtSecret: process.env.JWT_SECRET || 'spacetime-dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
