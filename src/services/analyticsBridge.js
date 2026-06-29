const analyticsPlugin = require("../plugins/analytics");

async function recordFromRequest(req, payload) {
  if (!(await analyticsPlugin.isActive())) return;

  const clientMetadata = analyticsPlugin.buildClientMetadata(
    req,
    payload.clientContext,
  );

  await analyticsPlugin.trackEvent({
    ...payload,
    clientMetadata,
    userAgent: clientMetadata.userAgent,
  });
}

module.exports = {
  recordFromRequest,
  isActive: () => analyticsPlugin.isActive(),
  getStatus: () => analyticsPlugin.getPluginStatus(),
};
