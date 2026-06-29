const express = require("express");
const blogController = require("../controllers/blogController");
const authenticate = require("../middleware/authenticate");
const { requireAdmin } = require("../middleware/requireAdmin");
const { blogMediaFields } = require("../middleware/blogUpload");

const router = express.Router();

router.get("/posts", blogController.getPublishedPosts);
router.get("/posts/slug/:slug", blogController.getPublishedBySlug);

router.get("/admin/posts", authenticate, requireAdmin, blogController.getAll);
router.get("/admin/posts/:id", authenticate, requireAdmin, blogController.getById);
router.post(
  "/admin/posts",
  authenticate,
  requireAdmin,
  blogMediaFields,
  blogController.create,
);
router.put(
  "/admin/posts/:id",
  authenticate,
  requireAdmin,
  blogMediaFields,
  blogController.update,
);
router.delete(
  "/admin/posts/:id",
  authenticate,
  requireAdmin,
  blogController.remove,
);

module.exports = router;
