const mongoose = require("mongoose");
const Bid = require("../models/Bid");
const { isPropertyOwner } = require("../middleware/requirePropertyManager");

function parseIndianNumber(value) {
  const cleaned = String(value ?? "")
    .replace(/[,\s₹]/g, "")
    .trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAuctionEnded(auctionEndDateTime) {
  if (!auctionEndDateTime) return false;
  return new Date(auctionEndDateTime).getTime() <= Date.now();
}

async function getTopBidsByPropertyIds(propertyIds) {
  if (!propertyIds.length) return {};

  const objectIds = propertyIds.map((id) => new mongoose.Types.ObjectId(id));
  const bids = await Bid.aggregate([
    { $match: { propertyId: { $in: objectIds } } },
    { $sort: { amount: -1 } },
    {
      $group: {
        _id: "$propertyId",
        amount: { $first: "$amount" },
      },
    },
  ]);

  return bids.reduce((map, bid) => {
    map[String(bid._id)] = bid.amount;
    return map;
  }, {});
}

async function getCurrentBidAmount(property) {
  const topBid = await Bid.findOne({ propertyId: property._id })
    .sort({ amount: -1 })
    .lean();

  if (topBid) return topBid.amount;
  return parseIndianNumber(property.startingBidAmount);
}

async function getLeadingBidForProperty(propertyId) {
  return Bid.findOne({ propertyId })
    .sort({ amount: -1, createdAt: -1 })
    .select("userId amount")
    .lean();
}

async function getUserHighestBidForProperty(propertyId, userId) {
  if (!propertyId || !userId) return null;
  return Bid.findOne({ propertyId, userId })
    .sort({ amount: -1, createdAt: -1 })
    .select("amount")
    .lean();
}

async function attachLeadingBidderInfo(properties, userId) {
  return Promise.all(
    properties.map(async (property) => {
      const leadingBid = await getLeadingBidForProperty(property._id);
      const userBid = userId
        ? await getUserHighestBidForProperty(property._id, userId)
        : null;

      return {
        ...property,
        leadingBidderId: leadingBid?.userId ? String(leadingBid.userId) : null,
        leadingBidAmount: leadingBid?.amount ?? null,
        userLastBidAmount: userBid?.amount ?? null,
      };
    }),
  );
}

function attachCurrentBidAmounts(properties, topBidsByPropertyId) {
  return properties.map((property) => ({
    ...property,
    currentBidAmount:
      topBidsByPropertyId[String(property._id)] ??
      parseIndianNumber(property.startingBidAmount),
  }));
}

function canUserPlaceBid(user, property) {
  if (!user || !property) return false;
  if (isPropertyOwner(user, property)) return false;
  if (user.role === "Buyer") return true;
  if (user.role === "Broker") {
    return String(property.canBrokerBid).toLowerCase() === "yes";
  }
  return false;
}

function getBidRestrictionMessage(user, property) {
  if (!user || !property) return "You are not allowed to bid on this property";
  if (isPropertyOwner(user, property)) {
    return "You cannot bid on your own property. Sellers are not allowed to bid on listings they own.";
  }
  if (user.role === "Broker" && String(property.canBrokerBid).toLowerCase() !== "yes") {
    return "Brokers are not permitted to bid on this property.";
  }
  if (user.role !== "Buyer" && user.role !== "Broker") {
    return "Only buyers and eligible brokers can place bids on live auctions.";
  }
  return "You are not allowed to bid on this property";
}

module.exports = {
  parseIndianNumber,
  isAuctionEnded,
  getTopBidsByPropertyIds,
  getCurrentBidAmount,
  getLeadingBidForProperty,
  getUserHighestBidForProperty,
  attachLeadingBidderInfo,
  attachCurrentBidAmounts,
  canUserPlaceBid,
  getBidRestrictionMessage,
};
