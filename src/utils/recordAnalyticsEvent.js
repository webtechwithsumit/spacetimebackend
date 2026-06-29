const AnalyticsEvent = require("../models/AnalyticsEvent");
const { isValidObjectId } = require("./validateId");

async function recordAnalyticsEvent({
  event,
  properties = {},
  userId,
  propertyId,
  sessionId,
  path,
  userAgent,
}) {
  if (!event) return;

  const resolvedPropertyId =
    propertyId ||
    (properties?.propertyId && isValidObjectId(String(properties.propertyId))
      ? properties.propertyId
      : undefined);

  try {
    await AnalyticsEvent.create({
      event,
      properties,
      userId: userId || undefined,
      propertyId: resolvedPropertyId || undefined,
      sessionId,
      path,
      userAgent,
    });
  } catch (err) {
    console.error("Failed to record analytics event:", err.message);
  }
}

module.exports = { recordAnalyticsEvent };
