const mongoose = require("mongoose");

const TICKET_CATEGORIES = [
  "Billing",
  "Auction",
  "KYC",
  "Technical",
  "General",
];

const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const TICKET_STATUSES = [
  "Open",
  "In Progress",
  "Waiting on User",
  "Resolved",
  "Closed",
];

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, trim: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: TICKET_CATEGORIES,
      default: "General",
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITIES,
      default: "Medium",
    },
    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: "Open",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    replyCount: { type: Number, default: 0, min: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ticketSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Ticket", ticketSchema);
module.exports.TICKET_CATEGORIES = TICKET_CATEGORIES;
module.exports.TICKET_PRIORITIES = TICKET_PRIORITIES;
module.exports.TICKET_STATUSES = TICKET_STATUSES;
