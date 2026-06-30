const analyticsConfig = require("../config");
const { isAnalyticsDBConnected } = require("../db");

async function isAnalyticsActive() {
  if (!analyticsConfig.enabled) return false;
  return isAnalyticsDBConnected();
}

async function hasAnalyticsFeature(feature) {
  const active = await isAnalyticsActive();
  if (!active) return false;
  return analyticsConfig.defaultFeatures.includes(feature);
}

async function getAnalyticsStatus() {
  const enabled = analyticsConfig.enabled;
  const active = enabled && isAnalyticsDBConnected();

  return {
    plugin: analyticsConfig.pluginName,
    enabled,
    active,
    features: active ? analyticsConfig.defaultFeatures : [],
  };
}

module.exports = {
  isAnalyticsActive,
  isAnalyticsLicensed: isAnalyticsActive,
  hasAnalyticsFeature,
  getAnalyticsStatus,
};
