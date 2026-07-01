const express = require("express");
const blogController = require("../controllers/blogController");
const authenticate = require("../middleware/authenticate");
const { requireAdmin } = require("../middleware/requireAdmin");
const { blogMediaFields } = require("../middleware/blogUpload");

const router = express.Router();

/**
 * @openapi
 * /api/blog/posts:
 *   get:
 *     summary: List published blog posts (public)
 *     tags: [Blog]
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated published blog posts
 */
router.get("/posts", blogController.getPublishedPosts);

/**
 * @openapi
 * /api/blog/posts/slug/{slug}:
 *   get:
 *     summary: Get published blog post by slug (public)
 *     tags: [Blog]
 *     parameters:
 *       - $ref: '#/components/parameters/BlogSlugParam'
 *     responses:
 *       200:
 *         description: Blog post detail
 *       404:
 *         description: Post not found
 */
router.get("/posts/slug/:slug", blogController.getPublishedBySlug);

/**
 * @openapi
 * /api/blog/admin/posts:
 *   get:
 *     summary: List all blog posts including drafts (Admin)
 *     tags: [Blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published]
 *     responses:
 *       200:
 *         description: Paginated blog posts
 *       403:
 *         description: Admin access required
 */
router.get("/admin/posts", authenticate, requireAdmin, blogController.getAll);

/**
 * @openapi
 * /api/blog/admin/posts/{id}:
 *   get:
 *     summary: Get blog post by ID (Admin)
 *     tags: [Blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Blog post MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Blog post detail
 *       404:
 *         description: Post not found
 */
router.get("/admin/posts/:id", authenticate, requireAdmin, blogController.getById);

/**
 * @openapi
 * /api/blog/admin/posts:
 *   post:
 *     summary: Create blog post (Admin)
 *     description: Accepts multipart/form-data for cover image and inline content images.
 *     tags: [Blog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title: { type: string }
 *               content: { type: string, description: HTML or rich text body }
 *               excerpt: { type: string }
 *               status: { type: string, enum: [draft, published] }
 *               coverImage: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Blog post created
 *       403:
 *         description: Admin access required
 */
router.post(
  "/admin/posts",
  authenticate,
  requireAdmin,
  blogMediaFields,
  blogController.create,
);

/**
 * @openapi
 * /api/blog/admin/posts/{id}:
 *   put:
 *     summary: Update blog post (Admin)
 *     description: Accepts multipart/form-data for cover image and inline content images.
 *     tags: [Blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               content: { type: string }
 *               excerpt: { type: string }
 *               status: { type: string, enum: [draft, published] }
 *               coverImage: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Blog post updated
 *       404:
 *         description: Post not found
 */
router.put(
  "/admin/posts/:id",
  authenticate,
  requireAdmin,
  blogMediaFields,
  blogController.update,
);

/**
 * @openapi
 * /api/blog/admin/posts/{id}:
 *   delete:
 *     summary: Delete blog post (Admin)
 *     tags: [Blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Blog post deleted
 *       404:
 *         description: Post not found
 */
router.delete(
  "/admin/posts/:id",
  authenticate,
  requireAdmin,
  blogController.remove,
);

module.exports = router;
