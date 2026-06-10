const express = require("express");
const router = express.Router();
const propertyController = require("../controllers/propertyController");
const authenticate = require("../middleware/authenticate");
const {
  requirePropertyManager,
} = require("../middleware/requirePropertyManager");
const { propertyMediaFields } = require("../middleware/propertyUpload");

/**
 * @openapi
 * /api/properties:
 *   get:
 *     summary: Get all properties
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of properties
 *       401:
 *         description: Unauthorized
 */
router.get("/", authenticate, propertyController.getAll);

/**
 * @openapi
 * /api/properties/live-auctions:
 *   get:
 *     summary: Get live auction properties (Buyer-facing)
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of live auction properties
 */
router.get("/live-auctions", propertyController.getLiveAuctions);

/**
 * @openapi
 * /api/properties/{id}:
 *   get:
 *     summary: Get property by ID
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property found
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
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
