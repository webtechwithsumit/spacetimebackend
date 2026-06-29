const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const authenticate = require("../middleware/authenticate");
const optionalAuthenticate = require("../middleware/optionalAuthenticate");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

/**
 * @openapi
 * /api/analytics/events:
 *   post:
 *     tags: [Analytics]
 *     summary: Record product analytics events
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Events recorded
 */
router.post("/events", optionalAuthenticate, analyticsController.trackEvents);

/**
 * @openapi
 * /api/analytics/overview:
 *   get:
 *     tags: [Analytics]
 *     summary: Get platform analytics overview (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Analytics overview
 */
router.get(
  "/overview",
  authenticate,
  requireAdmin,
  analyticsController.getOverview,
);

router.get(
  "/user-activity",
  authenticate,
  requireAdmin,
  analyticsController.getUserActivity,
);

router.get(
  "/activity-users",
  authenticate,
  requireAdmin,
  analyticsController.getActivityUsers,
);

router.get(
  "/activity-sessions",
  authenticate,
  requireAdmin,
  analyticsController.getActivitySessions,
);

router.get(
  "/property/:propertyId",
  authenticate,
  analyticsController.getPropertyAnalytics,
);

module.exports = router;
