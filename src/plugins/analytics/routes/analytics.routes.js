const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const authenticate = require("../../../middleware/authenticate");
const optionalAuthenticate = require("../../../middleware/optionalAuthenticate");
const { requireAdmin } = require("../../../middleware/requireAdmin");
const requireSuperAdmin = require("../../../middleware/requireSuperAdmin");
const { requireAnalyticsActive } = require("../middleware/requireAnalyticsActive");

function createAnalyticsRouter() {
  const router = express.Router();

  /**
   * @openapi
   * /api/analytics/status:
   *   get:
   *     summary: Get analytics plugin status
   *     description: Public endpoint. Returns whether analytics is enabled and active.
   *     tags: [Analytics]
   *     responses:
   *       200:
   *         description: Analytics platform status
   */
  router.get("/status", analyticsController.getStatus);

  /**
   * @openapi
   * /api/analytics/access:
   *   get:
   *     summary: Get current user's analytics access
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Platform status and user subscription access
   *       401:
   *         description: Authentication required
   */
  router.get(
    "/access",
    authenticate,
    requireAnalyticsActive,
    analyticsController.getAccess,
  );

  /**
   * @openapi
   * /api/analytics/events:
   *   post:
   *     summary: Track analytics events
   *     description: |
   *       Accepts single event or batch. Allowed events include page_view, auction_viewed,
   *       bid_placed, signup_completed, login, logout, click, property_card_click, property_search.
   *     tags: [Analytics]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - type: object
   *                 properties:
   *                   event: { type: string, example: page_view }
   *                   path: { type: string, example: /auctions }
   *                   properties: { type: object }
   *               - type: object
   *                 properties:
   *                   events:
   *                     type: array
   *                     items:
   *                       type: object
   *                       properties:
   *                         event: { type: string }
   *                         path: { type: string }
   *                         properties: { type: object }
   *     responses:
   *       201:
   *         description: Events recorded
   *       400:
   *         description: Invalid event payload
   */
  router.post("/events", optionalAuthenticate, requireAnalyticsActive, analyticsController.trackEvents);

  /**
   * @openapi
   * /api/analytics/overview:
   *   get:
   *     summary: Platform analytics overview (Admin)
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date }
   *         description: Start date (default last 30 days)
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date }
   *         description: End date (default today)
   *     responses:
   *       200:
   *         description: Overview metrics and charts data
   *       403:
   *         description: Admin access required
   */
  router.get(
    "/overview",
    authenticate,
    requireAdmin,
    requireAnalyticsActive,
    analyticsController.getOverview,
  );

  /**
   * @openapi
   * /api/analytics/user-activity:
   *   get:
   *     summary: User activity analytics (Admin)
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date }
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date }
   *     responses:
   *       200:
   *         description: User activity summary and trends
   *       403:
   *         description: Admin access required
   */
  router.get(
    "/user-activity",
    authenticate,
    requireAdmin,
    requireAnalyticsActive,
    analyticsController.getUserActivity,
  );

  /**
   * @openapi
   * /api/analytics/activity-users:
   *   get:
   *     summary: Paginated active users list (Admin)
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/PageParam'
   *       - $ref: '#/components/parameters/LimitParam'
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date }
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date }
   *     responses:
   *       200:
   *         description: Users with activity counts
   */
  router.get(
    "/activity-users",
    authenticate,
    requireAdmin,
    requireAnalyticsActive,
    analyticsController.getActivityUsers,
  );

  /**
   * @openapi
   * /api/analytics/activity-sessions:
   *   get:
   *     summary: Paginated user sessions (Admin)
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - $ref: '#/components/parameters/PageParam'
   *       - $ref: '#/components/parameters/LimitParam'
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date }
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date }
   *     responses:
   *       200:
   *         description: Session list with event counts
   */
  router.get(
    "/activity-sessions",
    authenticate,
    requireAdmin,
    requireAnalyticsActive,
    analyticsController.getActivitySessions,
  );

  /**
   * @openapi
   * /api/analytics/property/{propertyId}:
   *   get:
   *     summary: Property-level analytics
   *     description: Seller/Broker for own properties, or users with paid analytics subscription.
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: propertyId
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date }
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date }
   *     responses:
   *       200:
   *         description: Property views, clicks, and bid analytics
   *       403:
   *         description: No access to this property analytics
   */
  router.get(
    "/property/:propertyId",
    authenticate,
    requireAnalyticsActive,
    analyticsController.getPropertyAnalytics,
  );

  /**
   * @openapi
   * /api/analytics/subscriptions:
   *   get:
   *     summary: List seller analytics subscriptions (Super-Admin)
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Active analytics subscriptions
   *       403:
   *         description: Super-Admin access required
   */
  router.get(
    "/subscriptions",
    authenticate,
    requireSuperAdmin,
    requireAnalyticsActive,
    analyticsController.getSubscriptions,
  );

  /**
   * @openapi
   * /api/analytics/subscriptions/activate:
   *   post:
   *     summary: Activate analytics subscription for a user (Super-Admin)
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [userId]
   *             properties:
   *               userId: { type: string }
   *               notes: { type: string, description: Payment reference, amount, etc. }
   *     responses:
   *       201:
   *         description: Subscription activated
   *       400:
   *         description: Invalid request
   */
  router.post(
    "/subscriptions/activate",
    authenticate,
    requireSuperAdmin,
    requireAnalyticsActive,
    analyticsController.activateUserSubscription,
  );

  /**
   * @openapi
   * /api/analytics/subscriptions/deactivate:
   *   post:
   *     summary: Deactivate analytics subscription for a user (Super-Admin)
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [userId]
   *             properties:
   *               userId: { type: string }
   *     responses:
   *       200:
   *         description: Subscription deactivated
   *       400:
   *         description: userId required
   */
  router.post(
    "/subscriptions/deactivate",
    authenticate,
    requireSuperAdmin,
    requireAnalyticsActive,
    analyticsController.deactivateUserSubscription,
  );

  return router;
}

module.exports = { createAnalyticsRouter };
