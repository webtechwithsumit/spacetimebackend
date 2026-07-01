const express = require("express");
const ticketController = require("../controllers/ticketController");
const authenticate = require("../middleware/authenticate");
const { requireAdmin } = require("../middleware/requireAdmin");

const router = express.Router();

/**
 * @openapi
 * /api/tickets/meta:
 *   get:
 *     summary: Get support ticket metadata
 *     description: Returns available categories, priorities, and statuses for ticket forms.
 *     tags: [Support]
 *     responses:
 *       200:
 *         description: Ticket metadata
 */
router.get("/meta", ticketController.getMeta);

/**
 * @openapi
 * /api/tickets/admin/list:
 *   get:
 *     summary: List all support tickets (Admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by subject, ticket number, or description
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Open, In Progress, Waiting on User, Resolved, Closed]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High, Urgent]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Billing, Auction, KYC, Technical, General]
 *     responses:
 *       200:
 *         description: Paginated ticket list
 *       403:
 *         description: Admin access required
 */
router.get("/admin/list", authenticate, requireAdmin, ticketController.getAdminTickets);

/**
 * @openapi
 * /api/tickets/admin/users:
 *   get:
 *     summary: List admins for ticket assignment
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin and Super-Admin users
 *       403:
 *         description: Admin access required
 */
router.get("/admin/users", authenticate, requireAdmin, ticketController.getAdminUsers);

/**
 * @openapi
 * /api/tickets/admin/{id}:
 *   patch:
 *     summary: Update ticket status, priority, category, or assignee (Admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TicketIdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Open, In Progress, Waiting on User, Resolved, Closed]
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High, Urgent]
 *               category:
 *                 type: string
 *                 enum: [Billing, Auction, KYC, Technical, General]
 *               assignedTo:
 *                 type: string
 *                 nullable: true
 *                 description: Admin user ObjectId, or null to unassign
 *     responses:
 *       200:
 *         description: Ticket updated
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Ticket not found
 */
router.patch("/admin/:id", authenticate, requireAdmin, ticketController.updateTicket);

/**
 * @openapi
 * /api/tickets:
 *   post:
 *     summary: Create a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, description]
 *             properties:
 *               subject: { type: string, example: 'Unable to place bid on auction' }
 *               description: { type: string, example: 'I get a 403 error when bidding...' }
 *               category:
 *                 type: string
 *                 enum: [Billing, Auction, KYC, Technical, General]
 *                 default: General
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High, Urgent]
 *                 default: Medium
 *               propertyId:
 *                 type: string
 *                 description: Optional related property ObjectId
 *     responses:
 *       201:
 *         description: Ticket created
 *       401:
 *         description: Authentication required
 */
router.post("/", authenticate, ticketController.createTicket);

/**
 * @openapi
 * /api/tickets/mine:
 *   get:
 *     summary: Get logged-in user's support tickets
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Open, In Progress, Waiting on User, Resolved, Closed]
 *     responses:
 *       200:
 *         description: Paginated list of user tickets
 *       401:
 *         description: Authentication required
 */
router.get("/mine", authenticate, ticketController.getMyTickets);

/**
 * @openapi
 * /api/tickets/{id}:
 *   get:
 *     summary: Get ticket detail with replies
 *     description: Ticket owner or Admin/Super-Admin only.
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TicketIdParam'
 *     responses:
 *       200:
 *         description: Ticket detail with conversation thread
 *       403:
 *         description: Access denied
 *       404:
 *         description: Ticket not found
 */
router.get("/:id", authenticate, ticketController.getTicketById);

/**
 * @openapi
 * /api/tickets/{id}/replies:
 *   post:
 *     summary: Add a reply to a support ticket
 *     description: Admins may set isInternal true for notes visible only to staff.
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/TicketIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, example: 'Thanks, we are looking into this.' }
 *               isInternal:
 *                 type: boolean
 *                 default: false
 *                 description: Admin only — internal note not visible to user
 *     responses:
 *       201:
 *         description: Reply added
 *       400:
 *         description: Ticket is closed or reply empty
 *       403:
 *         description: Access denied
 */
router.post("/:id/replies", authenticate, ticketController.addReply);

module.exports = router;
