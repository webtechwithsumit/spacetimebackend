const mongoose = require("mongoose");

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    excerpt: { type: String, trim: true, default: "" },
    content: { type: String, default: "" },
    featuredImage: { type: String, trim: true, default: "" },
    tags: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    publishedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ title: "text", excerpt: "text", content: "text" });

module.exports = mongoose.model("BlogPost", blogPostSchema);
