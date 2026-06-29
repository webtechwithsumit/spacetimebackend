const analyticsConfig = require("./config");
const { connectAnalyticsDB, isAnalyticsDBConnected } = require("./db");
const { createAnalyticsRouter } = require("./routes/analytics.routes");
const { recordAnalyticsEvent } = require("./utils/recordAnalyticsEvent");
const { buildClientMetadata } = require("./utils/clientMetadata");
const {
  isAnalyticsLicensed,
  getAnalyticsStatus,
  activateLicense,
} = require("./services/licenseService");

let mounted = false;

async function initAnalyticsPlugin() {
  if (!analyticsConfig.enabled) {
    console.log("Analytics plugin disabled (ANALYTICS_ENABLED=false)");
    return { active: false };
  }

  await connectAnalyticsDB();

  if (analyticsConfig.licenseKey) {
    const licensed = await isAnalyticsLicensed();
    if (!licensed) {
      console.warn(
        "Analytics plugin enabled but no valid license found. Activate license via Super-Admin API.",
      );
    } else {
      console.log("Analytics plugin licensed and ready");
    }
  } else {
    console.warn(
      "Analytics plugin enabled but ANALYTICS_LICENSE_KEY is missing. Routes will stay locked until license is activated.",
    );
  }

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
  if (!analyticsConfig.enabled || !isAnalyticsDBConnected()) return false;
  return isAnalyticsLicensed();
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
  activateLicense,
  analyticsConfig,
};
