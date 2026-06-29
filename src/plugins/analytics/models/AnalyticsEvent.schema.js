const mongoose = require("mongoose");

function getAnalyticsEventSchema() {
  const analyticsEventSchema = new mongoose.Schema(
    {
      event: { type: String, required: true, trim: true, index: true },
      properties: { type: mongoose.Schema.Types.Mixed, default: {} },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
      },
      propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
      },
      sessionId: { type: String, trim: true, index: true },
      path: { type: String, trim: true },
      userAgent: { type: String, trim: true },
      ipAddress: { type: String, trim: true, index: true },
      browser: { type: String, trim: true },
      os: { type: String, trim: true },
      deviceType: { type: String, trim: true, index: true },
      country: { type: String, trim: true, index: true },
      region: { type: String, trim: true },
      city: { type: String, trim: true },
      timezone: { type: String, trim: true },
      language: { type: String, trim: true },
      referrer: { type: String, trim: true },
      screenWidth: { type: Number },
      screenHeight: { type: Number },
      organizationId: { type: String, trim: true, index: true },
    },
    { timestamps: true },
  );

  analyticsEventSchema.index({ createdAt: -1 });
  analyticsEventSchema.index({ propertyId: 1, createdAt: -1 });
  analyticsEventSchema.index({ event: 1, createdAt: -1 });
  analyticsEventSchema.index({ userId: 1, createdAt: -1 });

  return analyticsEventSchema;
}

module.exports = { getAnalyticsEventSchema };
