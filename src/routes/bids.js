const express = require("express");
const router = express.Router();
const bidController = require("../controllers/bidController");
const authenticate = require("../middleware/authenticate");

/**
 * @openapi
 * /api/bids/my-bids:
 *   get:
 *     summary: Get properties the logged-in user has bid on
 *     tags: [Bids]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: Paginated list of user bids
 *       401:
 *         description: Authentication required
 */
router.get("/my-bids", authenticate, bidController.getMyBids);

module.exports = router;
