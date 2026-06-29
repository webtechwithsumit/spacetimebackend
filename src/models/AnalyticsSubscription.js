const mongoose = require("mongoose");

const analyticsSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    enabled: { type: Boolean, default: true },
    plan: {
      type: String,
      enum: ["basic", "pro"],
      default: "basic",
    },
    features: {
      type: [String],
      default: () => ["property_analytics"],
    },
    activatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    activatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "AnalyticsSubscription",
  analyticsSubscriptionSchema,
);
