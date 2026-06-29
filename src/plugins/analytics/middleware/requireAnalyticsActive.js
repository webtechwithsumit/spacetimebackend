const { isAnalyticsLicensed, getAnalyticsStatus } = require("../services/licenseService");
const { isAnalyticsDBConnected } = require("../db");

const requireAnalyticsActive = async (req, res, next) => {
  if (!isAnalyticsDBConnected()) {
    return res.status(503).json({
      success: false,
      message: "Analytics plugin database is not connected",
      code: "ANALYTICS_DB_UNAVAILABLE",
    });
  }

  const licensed = await isAnalyticsLicensed();
  if (!licensed) {
    const status = await getAnalyticsStatus();
    return res.status(403).json({
      success: false,
      message: "Analytics plugin is not licensed for this deployment",
      code: "ANALYTICS_NOT_LICENSED",
      data: status,
    });
  }

  next();
};

module.exports = { requireAnalyticsActive };
