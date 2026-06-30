const CommunityPost = require("../models/CommunityPost");
const CommunityComment = require("../models/CommunityComment");
const { COMMUNITY_CATEGORIES } = require("../models/CommunityPost");
const { isValidObjectId } = require("../utils/validateId");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");

const activeFilter = { isDeleted: { $ne: true } };

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((tag) => String(tag).trim()).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function isAdmin(user) {
  return user?.role === "Admin" || user?.role === "Super-Admin";
}

function mapAuthor(user) {
  if (!user) return null;
  return {
    id: String(user._id ?? user),
    name: user.name ?? "",
    role: user.role ?? "",
    image: user.image ?? "",
  };
}

function mapPost(post) {
  return {
    id: String(post._id),
    title: post.title,
    body: post.body ?? "",
    category: post.category,
    tags: post.tags ?? [],
    commentCount: post.commentCount ?? 0,
    isPinned: Boolean(post.isPinned),
    authorId: mapAuthor(post.authorId),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function mapComment(comment) {
  return {
    id: String(comment._id),
    postId: String(comment.postId),
    content: comment.content,
    authorId: mapAuthor(comment.authorId),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

const getPosts = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { ...activeFilter };

  const search = trimString(req.query.search);
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { body: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  const category = trimString(req.query.category);
  if (category) {
    filter.category = category;
  }

  const [posts, total] = await Promise.all([
    CommunityPost.find(filter)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "name role image")
      .select("-body")
      .lean(),
    CommunityPost.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: posts.map(mapPost),
    pagination: buildPaginationMeta(page, limit, total),
  });
};

const getPostById = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid post id" });
  }

  const post = await CommunityPost.findOne({ _id: id, ...activeFilter })
    .populate("authorId", "name role image")
    .lean();

  if (!post) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }

  const comments = await CommunityComment.find({ postId: id, ...activeFilter })
    .sort({ createdAt: 1 })
    .populate("authorId", "name role image")
    .lean();

  res.json({
    success: true,
    data: {
      ...mapPost(post),
      comments: comments.map(mapComment),
    },
  });
};

const createPost = async (req, res) => {
  const title = trimString(req.body.title);
  const body = trimString(req.body.body);

  if (!title) {
    return res.status(400).json({ success: false, message: "Title is required" });
  }
  if (!body) {
    return res.status(400).json({ success: false, message: "Body is required" });
  }

  const category = trimString(req.body.category) || "General";
  if (!COMMUNITY_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: "Invalid category" });
  }

  const post = await CommunityPost.create({
    title,
    body,
    category,
    tags: parseTags(req.body.tags),
    authorId: req.user._id,
  });

  const created = await CommunityPost.findById(post._id)
    .populate("authorId", "name role image")
    .lean();

  res.status(201).json({
    success: true,
    message: "Post created",
    data: mapPost(created),
  });
};

const removePost = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid post id" });
  }

  const post = await CommunityPost.findOne({ _id: id, ...activeFilter });
  if (!post) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }

  const isOwner = String(post.authorId) === String(req.user._id);
  if (!isOwner && !isAdmin(req.user)) {
    return res.status(403).json({ success: false, message: "Not allowed to delete this post" });
  }

  post.isDeleted = true;
  post.deletedAt = new Date();
  await post.save();

  res.json({ success: true, message: "Post deleted" });
};

const addComment = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid post id" });
  }

  const content = trimString(req.body.content);
  if (!content) {
    return res.status(400).json({ success: false, message: "Comment is required" });
  }

  const post = await CommunityPost.findOne({ _id: id, ...activeFilter });
  if (!post) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }

  const comment = await CommunityComment.create({
    postId: id,
    authorId: req.user._id,
    content,
  });

  post.commentCount += 1;
  await post.save();

  const created = await CommunityComment.findById(comment._id)
    .populate("authorId", "name role image")
    .lean();

  res.status(201).json({
    success: true,
    message: "Comment added",
    data: mapComment(created),
  });
};

const removeComment = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid comment id" });
  }

  const comment = await CommunityComment.findOne({ _id: id, ...activeFilter });
  if (!comment) {
    return res.status(404).json({ success: false, message: "Comment not found" });
  }

  const isOwner = String(comment.authorId) === String(req.user._id);
  if (!isOwner && !isAdmin(req.user)) {
    return res.status(403).json({ success: false, message: "Not allowed to delete this comment" });
  }

  comment.isDeleted = true;
  comment.deletedAt = new Date();
  await comment.save();

  await CommunityPost.updateOne(
    { _id: comment.postId, commentCount: { $gt: 0 } },
    { $inc: { commentCount: -1 } },
  );

  res.json({ success: true, message: "Comment deleted" });
};

const getAdminPosts = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { ...activeFilter };

  const search = trimString(req.query.search);
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { body: { $regex: search, $options: "i" } },
    ];
  }

  const category = trimString(req.query.category);
  if (category) filter.category = category;

  const [posts, total] = await Promise.all([
    CommunityPost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "name role image email")
      .lean(),
    CommunityPost.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: posts.map(mapPost),
    pagination: buildPaginationMeta(page, limit, total),
  });
};

const adminRemovePost = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid post id" });
  }

  const post = await CommunityPost.findOne({ _id: id, ...activeFilter });
  if (!post) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }

  post.isDeleted = true;
  post.deletedAt = new Date();
  await post.save();

  res.json({ success: true, message: "Post removed" });
};

const togglePin = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid post id" });
  }

  const post = await CommunityPost.findOne({ _id: id, ...activeFilter });
  if (!post) {
    return res.status(404).json({ success: false, message: "Post not found" });
  }

  post.isPinned = !post.isPinned;
  await post.save();

  res.json({
    success: true,
    message: post.isPinned ? "Post pinned" : "Post unpinned",
    data: { id: String(post._id), isPinned: post.isPinned },
  });
};

const getCategories = (_req, res) => {
  res.json({ success: true, data: COMMUNITY_CATEGORIES });
};

module.exports = {
  getPosts,
  getPostById,
  createPost,
  removePost,
  addComment,
  removeComment,
  getAdminPosts,
  adminRemovePost,
  togglePin,
  getCategories,
};
