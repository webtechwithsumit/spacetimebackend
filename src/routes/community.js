const express = require("express");
const communityController = require("../controllers/communityController");
const authenticate = require("../middleware/authenticate");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

router.get("/categories", communityController.getCategories);
router.get("/posts", communityController.getPosts);
router.get("/posts/:id", communityController.getPostById);
router.post("/posts", authenticate, communityController.createPost);
router.delete("/posts/:id", authenticate, communityController.removePost);
router.post("/posts/:id/comments", authenticate, communityController.addComment);
router.delete("/comments/:id", authenticate, communityController.removeComment);

router.get("/admin/posts", authenticate, requireAdmin, communityController.getAdminPosts);
router.delete(
  "/admin/posts/:id",
  authenticate,
  requireAdmin,
  communityController.adminRemovePost,
);
router.patch(
  "/admin/posts/:id/pin",
  authenticate,
  requireAdmin,
  communityController.togglePin,
);

module.exports = router;
