const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authenticate = require("../middleware/authenticate");
const requireSuperAdmin = require("../middleware/requireSuperAdmin");

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get all users (Super-Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super-Admin access required
 */
router.get("/", authenticate, requireSuperAdmin, userController.getAll);

/**
 * @openapi
 * /api/users/create:
 *   post:
 *     summary: Create user (Super-Admin only)
 *     description: Super-Admin can create any user including Admin and Super-Admin roles.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
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
 *               role:
 *                 type: string
 *                 enum: [Buyer, Seller, Broker, Admin, Super-Admin]
 *                 example: Admin
 *               password: { type: string, example: secret123 }
 *     responses:
 *       201:
 *         description: User created
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Super-Admin access required
 */
router.post(
  "/create",
  authenticate,
  requireSuperAdmin,
  userController.createByAdmin,
);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 */
router.get("/:id", userController.getById);

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Save user (create or update)
 *     description: Body me id bhejo to update (agar id exist karti h), warna naya user create hoga.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               id: { type: string, description: 'Optional; agar exist kare to update' }
 *               name: { type: string }
 *               email: { type: string }
 *     responses:
 *       201:
 *         description: User created (created true)
 *       200:
 *         description: User updated (created false)
 */
router.post("/", userController.save);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 */
router.delete("/:id", userController.remove);

module.exports = router;
