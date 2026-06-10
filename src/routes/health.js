const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Server health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is running
 */
router.get('/', healthController.check);

module.exports = router;
