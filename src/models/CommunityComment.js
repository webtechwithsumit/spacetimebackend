const mongoose = require("mongoose");

const communityCommentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityPost",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String, required: true, trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

communityCommentSchema.index({ postId: 1, createdAt: 1 });

module.exports = mongoose.model("CommunityComment", communityCommentSchema);
