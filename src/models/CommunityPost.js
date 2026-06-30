const mongoose = require("mongoose");

const COMMUNITY_CATEGORIES = [
  "Auction Tips",
  "Market News",
  "Q&A",
  "Success Stories",
  "General",
];

const communityPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: COMMUNITY_CATEGORIES,
      default: "General",
    },
    tags: { type: [String], default: [] },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    commentCount: { type: Number, default: 0, min: 0 },
    isPinned: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

communityPostSchema.index({ isDeleted: 1, isPinned: -1, createdAt: -1 });
communityPostSchema.index({ title: "text", body: "text" });
communityPostSchema.index({ category: 1 });

module.exports = mongoose.model("CommunityPost", communityPostSchema);
module.exports.COMMUNITY_CATEGORIES = COMMUNITY_CATEGORIES;
