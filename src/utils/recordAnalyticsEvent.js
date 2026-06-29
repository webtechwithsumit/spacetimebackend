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
  clientMetadata = {},
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
      ipAddress: clientMetadata.ipAddress,
      browser: clientMetadata.browser,
      os: clientMetadata.os,
      deviceType: clientMetadata.deviceType,
      country: clientMetadata.country,
      region: clientMetadata.region,
      city: clientMetadata.city,
      timezone: clientMetadata.timezone,
      language: clientMetadata.language,
      referrer: clientMetadata.referrer,
      screenWidth: clientMetadata.screenWidth,
      screenHeight: clientMetadata.screenHeight,
    });
  } catch (err) {
    console.error("Failed to record analytics event:", err.message);
  }
}

module.exports = { recordAnalyticsEvent };
