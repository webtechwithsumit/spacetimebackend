const express = require("express");
const router = express.Router();
const profileController = require("../controllers/profileController");
const authenticate = require("../middleware/authenticate");
const { profileMediaFields } = require("../middleware/profileUpload");

/**
 * @openapi
 * /api/profile:
 *   get:
 *     summary: Get logged-in user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched
 *       401:
 *         description: Unauthorized
 */
router.get("/", authenticate, profileController.getProfile);

/**
 * @openapi
 * /api/profile:
 *   put:
 *     summary: Update logged-in user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               image: { type: string, description: 'Profile image URL' }
 *               aadharNo: { type: string, example: '123456789012' }
 *               password: { type: string, description: 'New password' }
 *               currentPassword: { type: string, description: 'Required when changing password' }
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put("/", authenticate, profileMediaFields, profileController.updateProfile);

module.exports = router;
