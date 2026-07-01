const Ticket = require("../models/Ticket");
const TicketReply = require("../models/TicketReply");
const User = require("../models/User");
const {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} = require("../models/Ticket");
const { isValidObjectId } = require("../utils/validateId");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");

const activeFilter = { isDeleted: { $ne: true } };

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isAdmin(user) {
  return user?.role === "Admin" || user?.role === "Super-Admin";
}

async function generateTicketNumber() {
  const count = await Ticket.countDocuments();
  return `ST-${String(count + 1).padStart(5, "0")}`;
}

function mapUser(user) {
  if (!user) return null;
  return {
    id: String(user._id ?? user),
    name: user.name ?? "",
    email: user.email ?? "",
    role: user.role ?? "",
    image: user.image ?? "",
  };
}

function mapProperty(property) {
  if (!property || !property._id) return null;
  return {
    id: String(property._id),
    title: property.title ?? "",
    city: property.city ?? "",
  };
}

function mapReply(reply, viewerIsAdmin) {
  if (reply.isInternal && !viewerIsAdmin) return null;
  return {
    id: String(reply._id),
    ticketId: String(reply.ticketId),
    content: reply.content,
    isInternal: Boolean(reply.isInternal),
    authorId: mapUser(reply.authorId),
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
  };
}

function mapTicket(ticket, options = {}) {
  const { includeDescription = false } = options;
  const mapped = {
    id: String(ticket._id),
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    replyCount: ticket.replyCount ?? 0,
    userId: mapUser(ticket.userId),
    assignedTo: mapUser(ticket.assignedTo),
    propertyId: mapProperty(ticket.propertyId),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt ?? null,
  };
  if (includeDescription) {
    mapped.description = ticket.description ?? "";
  }
  return mapped;
}

async function getTicketOr404(id, res) {
  if (!isValidObjectId(id)) {
    res.status(400).json({ success: false, message: "Invalid ticket id" });
    return null;
  }
  const ticket = await Ticket.findOne({ _id: id, ...activeFilter })
    .populate("userId", "name email role image")
    .populate("assignedTo", "name email role image")
    .populate("propertyId", "title city")
    .lean();
  if (!ticket) {
    res.status(404).json({ success: false, message: "Ticket not found" });
    return null;
  }
  return ticket;
}

function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false;
  if (isAdmin(user)) return true;
  return String(ticket.userId?._id ?? ticket.userId) === String(user._id);
}

const getMeta = (_req, res) => {
  res.json({
    success: true,
    data: {
      categories: TICKET_CATEGORIES,
      priorities: TICKET_PRIORITIES,
      statuses: TICKET_STATUSES,
    },
  });
};

const createTicket = async (req, res) => {
  const subject = trimString(req.body.subject);
  const description = trimString(req.body.description);

  if (!subject) {
    return res.status(400).json({ success: false, message: "Subject is required" });
  }
  if (!description) {
    return res.status(400).json({ success: false, message: "Description is required" });
  }

  const category = trimString(req.body.category) || "General";
  if (!TICKET_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: "Invalid category" });
  }

  const priority = trimString(req.body.priority) || "Medium";
  if (!TICKET_PRIORITIES.includes(priority)) {
    return res.status(400).json({ success: false, message: "Invalid priority" });
  }

  let propertyId = null;
  const rawPropertyId = trimString(req.body.propertyId);
  if (rawPropertyId) {
    if (!isValidObjectId(rawPropertyId)) {
      return res.status(400).json({ success: false, message: "Invalid property id" });
    }
    propertyId = rawPropertyId;
  }

  const ticketNumber = await generateTicketNumber();
  const ticket = await Ticket.create({
    ticketNumber,
    subject,
    description,
    category,
    priority,
    userId: req.user._id,
    propertyId,
  });

  const created = await Ticket.findById(ticket._id)
    .populate("userId", "name email role image")
    .populate("assignedTo", "name email role image")
    .populate("propertyId", "title city")
    .lean();

  res.status(201).json({
    success: true,
    message: "Support ticket created",
    data: mapTicket(created, { includeDescription: true }),
  });
};

const getMyTickets = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { ...activeFilter, userId: req.user._id };

  const status = trimString(req.query.status);
  if (status && TICKET_STATUSES.includes(status)) {
    filter.status = status;
  }

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email role image")
      .populate("assignedTo", "name email role image")
      .populate("propertyId", "title city")
      .select("-description")
      .lean(),
    Ticket.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: tickets.map((ticket) => mapTicket(ticket)),
    pagination: buildPaginationMeta(page, limit, total),
  });
};

const getTicketById = async (req, res) => {
  const ticket = await getTicketOr404(req.params.id, res);
  if (!ticket) return;

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const viewerIsAdmin = isAdmin(req.user);
  const replies = await TicketReply.find({
    ticketId: ticket._id,
    ...activeFilter,
  })
    .sort({ createdAt: 1 })
    .populate("authorId", "name email role image")
    .lean();

  res.json({
    success: true,
    data: {
      ...mapTicket(ticket, { includeDescription: true }),
      replies: replies
        .map((reply) => mapReply(reply, viewerIsAdmin))
        .filter(Boolean),
    },
  });
};

const addReply = async (req, res) => {
  const ticket = await getTicketOr404(req.params.id, res);
  if (!ticket) return;

  if (!canAccessTicket(req.user, ticket)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const content = trimString(req.body.content);
  if (!content) {
    return res.status(400).json({ success: false, message: "Reply is required" });
  }

  const viewerIsAdmin = isAdmin(req.user);
  const isInternal = Boolean(req.body.isInternal) && viewerIsAdmin;

  if (["Closed", "Resolved"].includes(ticket.status) && !viewerIsAdmin) {
    return res.status(400).json({
      success: false,
      message: "This ticket is closed. Contact support to reopen.",
    });
  }

  const reply = await TicketReply.create({
    ticketId: ticket._id,
    authorId: req.user._id,
    content,
    isInternal,
  });

  await Ticket.updateOne({ _id: ticket._id }, { $inc: { replyCount: 1 } });

  if (viewerIsAdmin && ticket.status === "Open") {
    await Ticket.updateOne({ _id: ticket._id }, { status: "In Progress" });
  } else if (!viewerIsAdmin && ticket.status === "Waiting on User") {
    await Ticket.updateOne({ _id: ticket._id }, { status: "In Progress" });
  } else if (viewerIsAdmin && !isInternal) {
    await Ticket.updateOne({ _id: ticket._id }, { status: "Waiting on User" });
  }

  const created = await TicketReply.findById(reply._id)
    .populate("authorId", "name email role image")
    .lean();

  res.status(201).json({
    success: true,
    message: "Reply added",
    data: mapReply(created, viewerIsAdmin),
  });
};

const getAdminTickets = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { ...activeFilter };

  const status = trimString(req.query.status);
  if (status && TICKET_STATUSES.includes(status)) {
    filter.status = status;
  }

  const priority = trimString(req.query.priority);
  if (priority && TICKET_PRIORITIES.includes(priority)) {
    filter.priority = priority;
  }

  const category = trimString(req.query.category);
  if (category && TICKET_CATEGORIES.includes(category)) {
    filter.category = category;
  }

  const search = trimString(req.query.search);
  if (search) {
    filter.$or = [
      { subject: { $regex: search, $options: "i" } },
      { ticketNumber: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email role image")
      .populate("assignedTo", "name email role image")
      .populate("propertyId", "title city")
      .select("-description")
      .lean(),
    Ticket.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: tickets.map((ticket) => mapTicket(ticket)),
    pagination: buildPaginationMeta(page, limit, total),
  });
};

const updateTicket = async (req, res) => {
  const ticket = await getTicketOr404(req.params.id, res);
  if (!ticket) return;

  const updates = {};

  const status = trimString(req.body.status);
  if (status) {
    if (!TICKET_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    updates.status = status;
    if (status === "Resolved" || status === "Closed") {
      updates.resolvedAt = new Date();
    } else {
      updates.resolvedAt = null;
    }
  }

  const priority = trimString(req.body.priority);
  if (priority) {
    if (!TICKET_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: "Invalid priority" });
    }
    updates.priority = priority;
  }

  const category = trimString(req.body.category);
  if (category) {
    if (!TICKET_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "Invalid category" });
    }
    updates.category = category;
  }

  if (req.body.assignedTo !== undefined) {
    const assignedTo = trimString(req.body.assignedTo);
    if (!assignedTo) {
      updates.assignedTo = null;
    } else {
      if (!isValidObjectId(assignedTo)) {
        return res.status(400).json({ success: false, message: "Invalid assignee id" });
      }
      const assignee = await User.findById(assignedTo).select("role").lean();
      if (!assignee || !isAdmin(assignee)) {
        return res.status(400).json({
          success: false,
          message: "Assignee must be an Admin or Super-Admin",
        });
      }
      updates.assignedTo = assignedTo;
    }
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ success: false, message: "No valid updates provided" });
  }

  const updated = await Ticket.findByIdAndUpdate(
    ticket._id,
    { $set: updates },
    { new: true },
  )
    .populate("userId", "name email role image")
    .populate("assignedTo", "name email role image")
    .populate("propertyId", "title city")
    .lean();

  res.json({
    success: true,
    message: "Ticket updated",
    data: mapTicket(updated, { includeDescription: true }),
  });
};

const getAdminUsers = async (_req, res) => {
  const admins = await User.find({ role: { $in: ["Admin", "Super-Admin"] } })
    .select("name email role image")
    .sort({ name: 1 })
    .lean();

  res.json({
    success: true,
    data: admins.map((user) => mapUser(user)),
  });
};

module.exports = {
  getMeta,
  createTicket,
  getMyTickets,
  getTicketById,
  addReply,
  getAdminTickets,
  updateTicket,
  getAdminUsers,
};
