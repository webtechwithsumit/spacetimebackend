const app = require("./app");
const config = require("./config");
const connectDB = require("./config/db");
const analyticsPlugin = require("./plugins/analytics");

const start = async () => {
  await connectDB();

  if (config.analyticsEnabled) {
    await analyticsPlugin.initAnalyticsPlugin();
    analyticsPlugin.mountAnalyticsPlugin(app);
  }

  // Must run after all routes (including analytics plugin) are mounted
  app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });

  app.use((err, req, res, next) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size must be 10MB or less",
      });
    }
    if (err?.message?.includes("Only image files")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (
      err?.message?.includes("media") ||
      err?.message?.includes("Property") ||
      err?.message?.includes("Entity")
    ) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error(err.stack);
    res.status(500).json({ success: false, message: "Internal server error" });
  });

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`API docs (Scalar): http://localhost:${config.port}/reference`);
    if (config.analyticsEnabled) {
      console.log("Analytics plugin: enabled (separate spacetime-analytics DB)");
    }
  });
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
