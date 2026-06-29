const mongoose = require("mongoose");

const analyticsLicenseSchema = new mongoose.Schema(
  {
    licenseKey: { type: String, required: true, unique: true, trim: true },
    organizationName: { type: String, trim: true, default: "SpaceTime" },
    organizationId: { type: String, trim: true, default: "default" },
    enabled: { type: Boolean, default: true },
    plan: {
      type: String,
      enum: ["starter", "pro", "enterprise"],
      default: "pro",
    },
    features: {
      type: [String],
      default: () => [
        "events",
        "overview",
        "user_activity",
        "property_analytics",
        "geo_traffic",
      ],
    },
    maxEventsPerMonth: { type: Number, default: 100000 },
    activatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AnalyticsLicense", analyticsLicenseSchema);
