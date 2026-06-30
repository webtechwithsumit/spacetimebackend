const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const authenticate = require("../../../middleware/authenticate");
const optionalAuthenticate = require("../../../middleware/optionalAuthenticate");
const { requireAdmin } = require("../../../middleware/requireAdmin");
const requireSuperAdmin = require("../../../middleware/requireSuperAdmin");
const { requireAnalyticsActive } = require("../middleware/requireAnalyticsActive");

function createAnalyticsRouter() {
  const router = express.Router();

  router.get("/status", analyticsController.getStatus);

  router.get(
    "/access",
    authenticate,
    requireAnalyticsActive,
    analyticsController.getAccess,
  );

  router.post("/events", optionalAuthenticate, requireAnalyticsActive, analyticsController.trackEvents);

  router.get(
    "/overview",
    authenticate,
    requireAdmin,
    requireAnalyticsActive,
    analyticsController.getOverview,
  );

  router.get(
    "/user-activity",
    authenticate,
    requireAdmin,
    requireAnalyticsActive,
    analyticsController.getUserActivity,
  );

  router.get(
    "/activity-users",
    authenticate,
    requireAdmin,
    requireAnalyticsActive,
    analyticsController.getActivityUsers,
  );

  router.get(
    "/activity-sessions",
    authenticate,
    requireAdmin,
    requireAnalyticsActive,
    analyticsController.getActivitySessions,
  );

  router.get(
    "/property/:propertyId",
    authenticate,
    requireAnalyticsActive,
    analyticsController.getPropertyAnalytics,
  );

  router.get(
    "/subscriptions",
    authenticate,
    requireSuperAdmin,
    requireAnalyticsActive,
    analyticsController.getSubscriptions,
  );

  router.post(
    "/subscriptions/activate",
    authenticate,
    requireSuperAdmin,
    requireAnalyticsActive,
    analyticsController.activateUserSubscription,
  );

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
