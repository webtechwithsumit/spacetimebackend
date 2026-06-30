const { isAnalyticsActive, getAnalyticsStatus } = require("../services/licenseService");
const { isAnalyticsDBConnected } = require("../db");

const requireAnalyticsActive = async (req, res, next) => {
  if (!isAnalyticsDBConnected()) {
    return res.status(503).json({
      success: false,
      message: "Analytics plugin database is not connected",
      code: "ANALYTICS_DB_UNAVAILABLE",
    });
  }

  const active = await isAnalyticsActive();
  if (!active) {
    const status = await getAnalyticsStatus();
    return res.status(403).json({
      success: false,
      message: "Analytics is not enabled on this server",
      code: "ANALYTICS_DISABLED",
      data: status,
    });
  }

  next();
};

module.exports = { requireAnalyticsActive };
