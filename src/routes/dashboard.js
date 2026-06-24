const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

/**
 * @openapi
 * /api/dashboard/overview:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get role-based dashboard overview stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview data
 */
router.get("/overview", authenticate, dashboardController.getOverview);

module.exports = router;
