require("express-async-errors");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerSpec = require("./config/swagger");
const config = require("./config");
const { initBaseMediaFolders, getUploadRoot } = require("./utils/mediaStorage");

const authRoutes = require("./routes/auth");
const healthRoutes = require("./routes/health");
const profileRoutes = require("./routes/profile");
const userRoutes = require("./routes/users");
const propertyRoutes = require("./routes/properties");
const bidRoutes = require("./routes/bids");
const dashboardRoutes = require("./routes/dashboard");
const blogRoutes = require("./routes/blog");

initBaseMediaFolders();

const app = express();
app.set("trust proxy", 1);

// Security headers - CSP Scalar/CDN allow (warna /reference blank dikhta hai)
app.use(
  helmet({
    // Allow frontend (different port/domain) to embed /uploads images
    crossOriginResourcePolicy: { policy: "cross-origin" },
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

app.use("/uploads", express.static(getUploadRoot()));

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
app.use("/api/bids", bidRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/blog", blogRoutes);

// Analytics plugin is mounted from server.js when ANALYTICS_ENABLED=true

// 404 + error handlers are attached in server.js after plugin routes mount

module.exports = app;
