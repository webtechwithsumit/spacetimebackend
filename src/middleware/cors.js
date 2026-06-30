const cors = require("cors");
const config = require("../config");

function isLocalDevOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (hostname.endsWith(".local")) return true;
  } catch {
    return false;
  }
  return false;
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (String(process.env.CORS_ALLOW_ALL ?? "").toLowerCase() === "true") {
    return true;
  }
  if (config.allowedOrigins.length === 0) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) {
    return true;
  }
  return false;
}

module.exports = cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, origin || true);
      return;
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Content-Length", "Content-Type"],
  maxAge: 86400,
  optionsSuccessStatus: 204,
});
