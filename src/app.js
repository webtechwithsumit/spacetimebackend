require("express-async-errors");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerSpec = require("./config/swagger");
const config = require("./config");

const authRoutes = require("./routes/auth");
const healthRoutes = require("./routes/health");
const profileRoutes = require("./routes/profile");
const userRoutes = require("./routes/users");
const propertyRoutes = require("./routes/properties");

const app = express();

// Security headers - CSP Scalar/CDN allow (warna /reference blank dikhta hai)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
  })
);

// Rate limit - same IP zyada requests na bheje (abuse/brute force kam)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20000,
  message: { success: false, message: "Too many requests, try again later." },
});
app.use("/api/", limiter);

// CORS - ALLOWED_ORIGINS set ho to woh; nahi to sab allow
app.use(
  cors({
    origin:
      config.allowedOrigins.length > 0
        ? config.allowedOrigins
        : true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "500kb" }));

// Scalar API docs
let scalarMiddleware = null;
const serveReference = async (req, res, next) => {
  try {
    if (!scalarMiddleware) {
      const { apiReference } = await import("@scalar/express-api-reference");
      scalarMiddleware = apiReference({
        content: swaggerSpec,
        theme: "purple",
        pageTitle: "Spacetime API · Scalar",
      });
    }
    scalarMiddleware(req, res, next);
  } catch (e) {
    next(e);
  }
};
app.get("/reference", serveReference);
app.get("/reference/", (req, res) => res.redirect(302, "/reference"));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);
app.use("/api/properties", propertyRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

module.exports = app;
