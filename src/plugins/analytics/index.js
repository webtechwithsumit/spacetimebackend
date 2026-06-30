const analyticsConfig = require("./config");
const { connectAnalyticsDB, isAnalyticsDBConnected } = require("./db");
const { createAnalyticsRouter } = require("./routes/analytics.routes");
const { recordAnalyticsEvent } = require("./utils/recordAnalyticsEvent");
const { buildClientMetadata } = require("./utils/clientMetadata");
const { isAnalyticsActive, getAnalyticsStatus } = require("./services/licenseService");

let mounted = false;

async function initAnalyticsPlugin() {
  if (!analyticsConfig.enabled) {
    console.log("Analytics plugin disabled (ANALYTICS_ENABLED=false)");
    return { active: false };
  }

  await connectAnalyticsDB();
  console.log("Analytics plugin ready");

  return { active: true };
}

function mountAnalyticsPlugin(app) {
  if (mounted) return;
  app.use("/api/analytics", createAnalyticsRouter());
  mounted = true;
  console.log("Analytics plugin mounted at /api/analytics");
}

async function getPluginStatus() {
  return getAnalyticsStatus();
}

async function isActive() {
  return isAnalyticsActive();
}

async function trackEvent(payload) {
  return recordAnalyticsEvent(payload);
}

module.exports = {
  initAnalyticsPlugin,
  mountAnalyticsPlugin,
  getPluginStatus,
  isActive,
  trackEvent,
  buildClientMetadata,
  analyticsConfig,
};
