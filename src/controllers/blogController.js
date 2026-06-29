const BlogPost = require("../models/BlogPost");
const { slugify } = require("../utils/slugify");
const { isValidObjectId } = require("../utils/validateId");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");
const { getUploadedFeaturedImage } = require("../middleware/blogUpload");

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

async function buildUniqueSlug(title, excludeId) {
  const base = slugify(title);
  let slug = base;
  let counter = 1;

  while (true) {
    const query = { slug, ...activeFilter };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await BlogPost.findOne(query).select("_id").lean();
    if (!existing) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

function mapPost(post) {
  return {
    id: String(post._id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    content: post.content ?? "",
    featuredImage: post.featuredImage ?? "",
    tags: post.tags ?? [],
    status: post.status,
    authorId: post.authorId
      ? {
          id: String(post.authorId._id ?? post.authorId),
          name: post.authorId.name ?? "",
          email: post.authorId.email ?? "",
        }
      : null,
    publishedAt: post.publishedAt ?? null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

const getPublishedPosts = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { ...activeFilter, status: "published" };

  const search = trimString(req.query.search);
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { excerpt: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  const tag = trimString(req.query.tag);
  if (tag) {
    filter.tags = tag;
  }

  const [posts, total] = await Promise.all([
    BlogPost.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "name email")
      .select("-content")
      .lean(),
    BlogPost.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: posts.map(mapPost),
    pagination: buildPaginationMeta(page, limit, total),
  });
};

const getPublishedBySlug = async (req, res) => {
  const slug = trimString(req.params.slug).toLowerCase();
  if (!slug) {
    return res.status(400).json({ success: false, message: "Slug is required" });
  }

  const post = await BlogPost.findOne({
    slug,
    status: "published",
    ...activeFilter,
  })
    .populate("authorId", "name email")
    .lean();

  if (!post) {
    return res.status(404).json({ success: false, message: "Blog post not found" });
  }

  res.json({ success: true, data: mapPost(post) });
};

const getAll = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { ...activeFilter };

  const status = trimString(req.query.status);
  if (status) filter.status = status;

  const search = trimString(req.query.search);
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { excerpt: { $regex: search, $options: "i" } },
    ];
  }

  const [posts, total] = await Promise.all([
    BlogPost.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "name email")
      .lean(),
    BlogPost.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: posts.map(mapPost),
    pagination: buildPaginationMeta(page, limit, total),
  });
};

const getById = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid post id" });
  }

  const post = await BlogPost.findOne({ _id: id, ...activeFilter })
    .populate("authorId", "name email")
    .lean();

  if (!post) {
    return res.status(404).json({ success: false, message: "Blog post not found" });
  }

  res.json({ success: true, data: mapPost(post) });
};

const create = async (req, res) => {
  const title = trimString(req.body.title);
  if (!title) {
    return res.status(400).json({ success: false, message: "Title is required" });
  }

  const status = trimString(req.body.status) || "draft";
  if (!["draft", "published"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  const slugInput = trimString(req.body.slug);
  const slug = slugInput
    ? slugify(slugInput)
    : await buildUniqueSlug(title);
  const slugTaken = await BlogPost.findOne({ slug, ...activeFilter }).lean();
  if (slugTaken) {
    return res.status(400).json({ success: false, message: "Slug already exists" });
  }

  const uploadedImage = getUploadedFeaturedImage(req);
  const featuredImage =
    uploadedImage || trimString(req.body.featuredImage) || "";

  const post = await BlogPost.create({
    title,
    slug,
    excerpt: trimString(req.body.excerpt),
    content: trimString(req.body.content),
    featuredImage,
    tags: parseTags(req.body.tags),
    status,
    authorId: req.user._id,
    publishedAt: status === "published" ? new Date() : undefined,
  });

  const created = await BlogPost.findById(post._id)
    .populate("authorId", "name email")
    .lean();

  res.status(201).json({
    success: true,
    message: "Blog post created",
    data: mapPost(created),
  });
};

const update = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid post id" });
  }

  const post = await BlogPost.findOne({ _id: id, ...activeFilter });
  if (!post) {
    return res.status(404).json({ success: false, message: "Blog post not found" });
  }

  const title = trimString(req.body.title) || post.title;
  const status = trimString(req.body.status) || post.status;
  if (!["draft", "published"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  let slug = post.slug;
  const slugInput = trimString(req.body.slug);
  if (slugInput) {
    slug = slugify(slugInput);
    const slugTaken = await BlogPost.findOne({
      slug,
      _id: { $ne: post._id },
      ...activeFilter,
    }).lean();
    if (slugTaken) {
      return res.status(400).json({ success: false, message: "Slug already exists" });
    }
  } else if (title !== post.title) {
    slug = await buildUniqueSlug(title, post._id);
  }

  const uploadedImage = getUploadedFeaturedImage(req);
  const featuredImage =
    uploadedImage ||
    trimString(req.body.featuredImage) ||
    post.featuredImage ||
    "";

  post.title = title;
  post.slug = slug;
  post.excerpt = trimString(req.body.excerpt) ?? post.excerpt;
  post.content = trimString(req.body.content) ?? post.content;
  post.featuredImage = featuredImage;
  post.tags = req.body.tags !== undefined ? parseTags(req.body.tags) : post.tags;
  post.status = status;

  if (status === "published" && !post.publishedAt) {
    post.publishedAt = new Date();
  }
  if (status === "draft") {
    post.publishedAt = undefined;
  }

  await post.save();

  const updated = await BlogPost.findById(post._id)
    .populate("authorId", "name email")
    .lean();

  res.json({
    success: true,
    message: "Blog post updated",
    data: mapPost(updated),
  });
};

const remove = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid post id" });
  }

  const post = await BlogPost.findOne({ _id: id, ...activeFilter });
  if (!post) {
    return res.status(404).json({ success: false, message: "Blog post not found" });
  }

  post.isDeleted = true;
  post.deletedAt = new Date();
  await post.save();

  res.json({ success: true, message: "Blog post deleted" });
};

module.exports = {
  getPublishedPosts,
  getPublishedBySlug,
  getAll,
  getById,
  create,
  update,
  remove,
};
