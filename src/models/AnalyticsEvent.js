const mongoose = require("mongoose");

const analyticsEventSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, trim: true, index: true },
    properties: { type: mongoose.Schema.Types.Mixed, default: {} },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      index: true,
    },
    sessionId: { type: String, trim: true, index: true },
    path: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: true },
);

analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ propertyId: 1, createdAt: -1 });
analyticsEventSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);
