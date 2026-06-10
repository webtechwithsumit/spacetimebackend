const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone, role, password]
 *             properties:
 *               name: { type: string, example: John Doe }
 *               email: { type: string, example: john@example.com }
 *               phone: { type: string, example: '9876543210' }
 *               role: { type: string, example: Buyer }
 *               password: { type: string, example: secret123 }
 *     responses:
 *       201:
 *         description: User registered
 *       400:
 *         description: Validation error or email already exists
 */
router.post("/register", authController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: john@example.com }
 *               password: { type: string, example: secret123 }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", authController.login);

module.exports = router;
