require("dotenv").config();

const enabled = String(process.env.ANALYTICS_ENABLED ?? "false").toLowerCase() === "true";
const mongoUri =
  process.env.ANALYTICS_MONGODB_URI ||
  process.env.MONGODB_URI?.replace(/\/[^/?]+(\?|$)/, "/spacetime-analytics$1") ||
  "";

module.exports = {
  enabled,
  mongoUri,
  pluginName: "spacetime-analytics",
  defaultFeatures: [
    "events",
    "overview",
    "user_activity",
    "property_analytics",
    "geo_traffic",
  ],
};
