const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
  },
  { timestamps: true },
);

bidSchema.index({ propertyId: 1, amount: -1 });

module.exports = mongoose.model("Bid", bidSchema);
