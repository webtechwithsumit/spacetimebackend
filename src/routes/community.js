const express = require("express");
const communityController = require("../controllers/communityController");
const authenticate = require("../middleware/authenticate");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

/**
 * @openapi
 * /api/community/categories:
 *   get:
 *     summary: Get community post categories
 *     tags: [Community]
 *     responses:
 *       200:
 *         description: List of category names
 */
router.get("/categories", communityController.getCategories);

/**
 * @openapi
 * /api/community/posts:
 *   get:
 *     summary: List community posts (public)
 *     tags: [Community]
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Auction Tips, Market News, Q&A, Success Stories, General]
 *     responses:
 *       200:
 *         description: Paginated community posts
 */
router.get("/posts", communityController.getPosts);

/**
 * @openapi
 * /api/community/posts/{id}:
 *   get:
 *     summary: Get community post with comments
 *     tags: [Community]
 *     parameters:
 *       - $ref: '#/components/parameters/PostIdParam'
 *     responses:
 *       200:
 *         description: Post detail with comments
 *       404:
 *         description: Post not found
 */
router.get("/posts/:id", communityController.getPostById);

/**
 * @openapi
 * /api/community/posts:
 *   post:
 *     summary: Create a community post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title: { type: string, example: 'Tips for first-time bidders' }
 *               body: { type: string }
 *               category:
 *                 type: string
 *                 enum: [Auction Tips, Market News, Q&A, Success Stories, General]
 *               tags:
 *                 oneOf:
 *                   - type: array
 *                     items: { type: string }
 *                   - type: string
 *                     description: Comma-separated or JSON array string
 *     responses:
 *       201:
 *         description: Post created
 *       401:
 *         description: Authentication required
 */
router.post("/posts", authenticate, communityController.createPost);

/**
 * @openapi
 * /api/community/posts/{id}:
 *   delete:
 *     summary: Delete own community post (or Admin)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PostIdParam'
 *     responses:
 *       200:
 *         description: Post deleted
 *       403:
 *         description: Not allowed
 *       404:
 *         description: Post not found
 */
router.delete("/posts/:id", authenticate, communityController.removePost);

/**
 * @openapi
 * /api/community/posts/{id}/comments:
 *   post:
 *     summary: Add a comment to a community post
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PostIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, example: 'Great advice, thanks!' }
 *     responses:
 *       201:
 *         description: Comment added
 *       404:
 *         description: Post not found
 */
router.post("/posts/:id/comments", authenticate, communityController.addComment);

/**
 * @openapi
 * /api/community/comments/{id}:
 *   delete:
 *     summary: Delete own comment (or Admin)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Comment MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Comment deleted
 *       403:
 *         description: Not allowed
 *       404:
 *         description: Comment not found
 */
router.delete("/comments/:id", authenticate, communityController.removeComment);

/**
 * @openapi
 * /api/community/admin/posts:
 *   get:
 *     summary: List all community posts for moderation (Admin)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated posts for admin moderation
 *       403:
 *         description: Admin access required
 */
router.get("/admin/posts", authenticate, requireAdmin, communityController.getAdminPosts);

/**
 * @openapi
 * /api/community/admin/posts/{id}:
 *   delete:
 *     summary: Remove community post (Admin)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PostIdParam'
 *     responses:
 *       200:
 *         description: Post removed
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Post not found
 */
router.delete(
  "/admin/posts/:id",
  authenticate,
  requireAdmin,
  communityController.adminRemovePost,
);

/**
 * @openapi
 * /api/community/admin/posts/{id}/pin:
 *   patch:
 *     summary: Toggle pin on community post (Admin)
 *     tags: [Community]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PostIdParam'
 *     responses:
 *       200:
 *         description: Pin toggled
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Post not found
 */
router.patch(
  "/admin/posts/:id/pin",
  authenticate,
  requireAdmin,
  communityController.togglePin,
);

module.exports = router;
