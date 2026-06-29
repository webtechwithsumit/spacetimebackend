const mongoose = require("mongoose");
const analyticsConfig = require("./config");
const { getAnalyticsEventSchema } = require("./models/AnalyticsEvent.schema");

let analyticsConnection = null;
let AnalyticsEvent = null;

async function connectAnalyticsDB() {
  if (analyticsConnection) return analyticsConnection;

  if (!analyticsConfig.mongoUri) {
    throw new Error("ANALYTICS_MONGODB_URI or MONGODB_URI is required for analytics");
  }

  analyticsConnection = mongoose.createConnection(analyticsConfig.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });

  await analyticsConnection.asPromise();

  AnalyticsEvent = analyticsConnection.model(
    "AnalyticsEvent",
    getAnalyticsEventSchema(),
  );

  console.log(`Analytics MongoDB connected (${analyticsConfig.pluginName})`);
  return analyticsConnection;
}

function getAnalyticsConnection() {
  return analyticsConnection;
}

function getAnalyticsEventModel() {
  if (!AnalyticsEvent) {
    throw new Error("Analytics database is not connected");
  }
  return AnalyticsEvent;
}

function isAnalyticsDBConnected() {
  return Boolean(analyticsConnection?.readyState === 1);
}

module.exports = {
  connectAnalyticsDB,
  getAnalyticsConnection,
  getAnalyticsEventModel,
  isAnalyticsDBConnected,
};
