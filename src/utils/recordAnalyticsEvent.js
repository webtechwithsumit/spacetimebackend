const AnalyticsEvent = require("../models/AnalyticsEvent");

async function recordAnalyticsEvent({
  event,
  properties = {},
  userId,
  sessionId,
  path,
  userAgent,
}) {
  if (!event) return;

  try {
    await AnalyticsEvent.create({
      event,
      properties,
      userId: userId || undefined,
      sessionId,
      path,
      userAgent,
    });
  } catch (err) {
    console.error("Failed to record analytics event:", err.message);
  }
}

module.exports = { recordAnalyticsEvent };
