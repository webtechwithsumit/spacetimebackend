const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    images: { type: [String], default: [] },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },
    category: { type: String, required: true, trim: true },
    buildingType: { type: String, trim: true, default: "" },
    area: { type: String, trim: true, default: "" },
    pricePerSqft: { type: String, trim: true, default: "" },
    status: { type: String, trim: true, default: "" },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Property", propertySchema);
