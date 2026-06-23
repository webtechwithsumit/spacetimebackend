const express = require("express");
const router = express.Router();
const propertyController = require("../controllers/propertyController");
const bidController = require("../controllers/bidController");
const optionalAuthenticate = require("../middleware/optionalAuthenticate");
const authenticate = require("../middleware/authenticate");
const {
  requirePropertyManager,
} = require("../middleware/requirePropertyManager");
const { propertyMediaFields } = require("../middleware/propertyUpload");

/**
 * @openapi
 * /api/properties:
 *   get:
 *     summary: Get all properties (Seller / Broker / Admin)
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: title
 *         schema: { type: string }
 *         description: Filter by property title (case-insensitive)
 *     responses:
 *       200:
 *         description: Paginated list of properties
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Use live auctions endpoint as a Buyer
 */
router.get("/", authenticate, propertyController.getAll);

/**
 * @openapi
 * /api/properties/live-auctions:
 *   get:
 *     summary: Get live auction properties (public)
 *     description: |
 *       Returns properties with `auctionStatus: Live`.
 *       Use `sort=latest` + `limit=4` for homepage featured auctions.
 *       Default sort is ending soonest first.
 *     tags: [Properties]
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [latest, ending]
 *           default: ending
 *         description: |
 *           `latest` = newest properties first (createdAt desc).
 *           `ending` = ending soonest first (default).
 *     responses:
 *       200:
 *         description: Paginated list of live auction properties with currentBidAmount
 */
router.get("/live-auctions", propertyController.getLiveAuctions);

/**
 * @openapi
 * /api/properties/live-auctions/{id}:
 *   get:
 *     summary: Get a live auction property by ID (public)
 *     description: Used on the bid page. Returns 404 if property is not live.
 *     tags: [Properties]
 *     parameters:
 *       - $ref: '#/components/parameters/PropertyIdParam'
 *     responses:
 *       200:
 *         description: Live auction property found
 *       404:
 *         description: Property not found or not live
 */
router.get("/live-auctions/:id", optionalAuthenticate, propertyController.getLiveAuctionById);

/**
 * @openapi
 * /api/properties/{id}/bids:
 *   post:
 *     summary: Place a bid on a live auction property
 *     description: Buyer role required. Broker can bid only when property `canBrokerBid` is Yes.
 *     tags: [Bids]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PropertyIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlaceBidRequest'
 *     responses:
 *       201:
 *         description: Bid placed successfully
 *       400:
 *         description: Invalid bid amount or auction ended
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not allowed to bid on this property
 *       404:
 *         description: Live auction property not found
 */
router.post("/:id/bids", authenticate, bidController.placeBid);

/**
 * @openapi
 * /api/properties/{id}:
 *   get:
 *     summary: Get property by ID
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PropertyIdParam'
 *     responses:
 *       200:
 *         description: Property found
 *       403:
 *         description: Not allowed to view this property
 *       404:
 *         description: Property not found
 */
router.get("/:id", authenticate, propertyController.getById);

/**
 * @openapi
 * /api/properties:
 *   post:
 *     summary: Create property (Seller/Admin)
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, category]
 *             properties:
 *               title: { type: string, example: '3BHK Apartment in Gurgaon' }
 *               description: { type: string }
 *               images: { type: array, items: { type: string } }
 *               address: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               pincode: { type: string }
 *               category: { type: string }
 *               buildingType: { type: string }
 *               area: { type: string, example: '1200 sqft' }
 *               pricePerSqft: { type: string, example: '8500' }
 *               status: { type: string }
 *     responses:
 *       201:
 *         description: Property created
 *       403:
 *         description: Seller or Admin access required
 */
router.post(
  "/",
  authenticate,
  requirePropertyManager,
  propertyMediaFields,
  propertyController.create,
);

/**
 * @openapi
 * /api/properties/{id}:
 *   put:
 *     summary: Update property
 *     description: Seller/Broker can update own properties. Admin can update any. Set auctionStatus to manage live/ended state.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PropertyIdParam'
 *     responses:
 *       200:
 *         description: Property updated
 *       403:
 *         description: Not allowed
 *       404:
 *         description: Property not found
 */
router.put(
  "/:id",
  authenticate,
  propertyMediaFields,
  propertyController.update,
);

/**
 * @openapi
 * /api/properties/{id}:
 *   delete:
 *     summary: Soft delete property
 *     description: Property is not removed from database; isDeleted is set to true.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PropertyIdParam'
 *     responses:
 *       200:
 *         description: Property deleted
 *       403:
 *         description: Not allowed
 *       404:
 *         description: Property not found
 */
router.delete("/:id", authenticate, propertyController.remove);

module.exports = router;
