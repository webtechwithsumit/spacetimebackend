const Property = require("../models/Property");
const Bid = require("../models/Bid");
const User = require("../models/User");
const mongoose = require("mongoose");
const { isValidObjectId } = require("../utils/validateId");
const {
  buildLiveAuctionsFilter,
  isAdminRole,
} = require("../middleware/requirePropertyManager");
const {
  buildEndedStageFilter,
  buildLiveStageFilter,
  filterPropertiesForMonitorStage,
} = require("../utils/auctionStageHelpers");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");
const {
  parseIndianNumber,
  isAuctionEnded,
  getCurrentBidAmount,
  getLeadingBidForProperty,
  getTopBidsByPropertyIds,
  attachLeadingBidderInfo,
  canUserPlaceBid,
  getBidRestrictionMessage,
} = require("../utils/bidHelpers");

const activePropertyFilter = { isDeleted: { $ne: true } };

const placeBid = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid property id" });
  }

  const bidAmount = parseIndianNumber(amount);
  if (!bidAmount || bidAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid bid amount",
    });
  }

  const property = await Property.findOne({
    _id: id,
    ...activePropertyFilter,
    ...buildLiveAuctionsFilter(),
  }).lean();

  if (!property) {
    return res.status(404).json({
      success: false,
      message: "Live auction property not found",
    });
  }

  if (isAuctionEnded(property.auctionEndDateTime)) {
    return res.status(400).json({
      success: false,
      message: "This auction has ended",
    });
  }

  if (!canUserPlaceBid(req.user, property)) {
    return res.status(403).json({
      success: false,
      message: getBidRestrictionMessage(req.user, property),
    });
  }

  const leadingBid = await getLeadingBidForProperty(property._id);
  if (leadingBid && String(leadingBid.userId) === String(req.user._id)) {
    return res.status(400).json({
      success: false,
      message:
        "You are already the highest bidder. Place a new bid only after someone outbids you.",
    });
  }

  const currentBid = await getCurrentBidAmount(property);
  const increment = parseIndianNumber(property.bidIncrement);
  const minimumBid = increment > 0 ? currentBid + increment : currentBid + 1;

  if (bidAmount < minimumBid) {
    return res.status(400).json({
      success: false,
      message: `Your bid must be at least ${minimumBid}`,
      data: { minimumBid, currentBid },
    });
  }

  const bid = await Bid.create({
    propertyId: property._id,
    userId: req.user._id,
    amount: bidAmount,
  });

  res.status(201).json({
    success: true,
    message: "Bid placed successfully",
    data: {
      bid,
      currentBidAmount: bidAmount,
    },
  });
};

const myBidPropertyFields =
  "title images category city microMarketLocality auctionStatus auctionEndDateTime startingBidAmount status";

const getMyBids = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const userId = new mongoose.Types.ObjectId(req.user._id);

  const userBidGroups = await Bid.aggregate([
    { $match: { userId } },
    { $sort: { amount: -1, createdAt: -1 } },
    {
      $group: {
        _id: "$propertyId",
        myHighestBid: { $first: "$amount" },
        lastBidAt: { $first: "$createdAt" },
        totalBids: { $sum: 1 },
      },
    },
    { $sort: { lastBidAt: -1 } },
  ]);

  const total = userBidGroups.length;
  const paginatedGroups = userBidGroups.slice(skip, skip + limit);
  const propertyIds = paginatedGroups.map((group) => group._id);

  if (!propertyIds.length) {
    return res.json({
      success: true,
      data: [],
      pagination: buildPaginationMeta(page, limit, total),
    });
  }

  const properties = await Property.find({
    _id: { $in: propertyIds },
    ...activePropertyFilter,
  })
    .select(myBidPropertyFields)
    .lean();

  const topBidsByPropertyId = await getTopBidsByPropertyIds(
    propertyIds.map(String),
  );
  const enrichedProperties = await attachLeadingBidderInfo(
    properties,
    req.user._id,
  );
  const enrichedMap = new Map(
    enrichedProperties.map((property) => [String(property._id), property]),
  );

  const data = paginatedGroups
    .map((group) => {
      const property = enrichedMap.get(String(group._id));
      if (!property) return null;

      const currentBidAmount =
        topBidsByPropertyId[String(group._id)] ??
        parseIndianNumber(property.startingBidAmount);

      return {
        propertyId: String(group._id),
        property,
        myHighestBid: group.myHighestBid,
        lastBidAt: group.lastBidAt,
        totalBids: group.totalBids,
        currentBidAmount,
        isLeading: property.leadingBidderId === String(req.user._id),
        isAuctionLive: property.auctionStatus === "Live",
        isAuctionEnded: isAuctionEnded(property.auctionEndDateTime),
      };
    })
    .filter(Boolean);

  res.json({
    success: true,
    data,
    pagination: buildPaginationMeta(page, limit, total),
  });
};

const liveMonitorPropertyFields =
  "title city microMarketLocality startingBidAmount auctionEndDateTime auctionStartDateTime auctionStatus images category";

function sortBidMonitorItems(data, status) {
  if (status === "ended") {
    data.sort((a, b) => {
      const endDiff =
        new Date(b.auctionEndDateTime).getTime() -
        new Date(a.auctionEndDateTime).getTime();
      if (endDiff !== 0) return endDiff;
      if (b.totalBids !== a.totalBids) return b.totalBids - a.totalBids;
      return b.currentBidAmount - a.currentBidAmount;
    });
    return data;
  }

  data.sort((a, b) => {
    if (b.totalBids !== a.totalBids) return b.totalBids - a.totalBids;
    if (b.uniqueBidders !== a.uniqueBidders) {
      return b.uniqueBidders - a.uniqueBidders;
    }
    if (b.currentBidAmount !== a.currentBidAmount) {
      return b.currentBidAmount - a.currentBidAmount;
    }
    return (
      new Date(a.auctionEndDateTime).getTime() -
      new Date(b.auctionEndDateTime).getTime()
    );
  });

  return data;
}

async function buildBidMonitorItems(properties) {
  if (!properties.length) return [];

  const propertyIds = properties.map((property) => property._id);
  const topBidsByPropertyId = await getTopBidsByPropertyIds(
    propertyIds.map(String),
  );

  const allBidRecords = await Bid.find({ propertyId: { $in: propertyIds } })
    .sort({ createdAt: -1 })
    .lean();

  const userIds = [...new Set(allBidRecords.map((bid) => String(bid.userId)))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("name email phone role")
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const bidsByProperty = new Map();
  const uniqueBiddersByProperty = new Map();

  for (const bid of allBidRecords) {
    const propertyId = String(bid.propertyId);
    const userId = String(bid.userId);
    const user = userMap.get(userId);

    if (!bidsByProperty.has(propertyId)) {
      bidsByProperty.set(propertyId, []);
      uniqueBiddersByProperty.set(propertyId, new Set());
    }

    uniqueBiddersByProperty.get(propertyId).add(userId);
    bidsByProperty.get(propertyId).push({
      bidId: String(bid._id),
      userId,
      name: user?.name ?? "Unknown",
      email: user?.email ?? "—",
      phone: user?.phone ?? "—",
      role: user?.role ?? "—",
      amount: bid.amount,
      createdAt: bid.createdAt,
    });
  }

  const leadingBidIdByProperty = new Map();
  for (const propertyId of propertyIds.map(String)) {
    const propertyBids = bidsByProperty.get(propertyId) ?? [];
    if (!propertyBids.length) continue;
    const leading = [...propertyBids].sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0];
    leadingBidIdByProperty.set(propertyId, leading.bidId);
  }

  return properties.map((property) => {
    const propertyId = String(property._id);
    const bids = (bidsByProperty.get(propertyId) ?? []).map((bid) => ({
      ...bid,
      isLeading: leadingBidIdByProperty.get(propertyId) === bid.bidId,
    }));
    const leadingBid = bids.find((bid) => bid.isLeading) ?? null;
    const currentBidAmount =
      topBidsByPropertyId[propertyId] ??
      parseIndianNumber(property.startingBidAmount);

    return {
      propertyId,
      title: property.title,
      city: property.city ?? "",
      microMarketLocality: property.microMarketLocality ?? "",
      category: property.category ?? "",
      image: property.images?.[0] ?? null,
      startingBidAmount: parseIndianNumber(property.startingBidAmount),
      currentBidAmount,
      auctionStartDateTime: property.auctionStartDateTime ?? "",
      auctionEndDateTime: property.auctionEndDateTime ?? "",
      totalBids: bids.length,
      uniqueBidders: uniqueBiddersByProperty.get(propertyId)?.size ?? 0,
      leadingBidder: leadingBid
        ? {
            userId: leadingBid.userId,
            name: leadingBid.name,
            email: leadingBid.email,
            amount: leadingBid.amount,
          }
        : null,
      bids,
    };
  });
}

const getLiveBidMonitor = async (req, res) => {
  const role = req.user?.role;
  const isAdmin = isAdminRole(role);
  const isManager = role === "Seller" || role === "Broker";

  if (!isAdmin && !isManager) {
    return res.status(403).json({
      success: false,
      message: "Admin, Seller, or Broker access required",
    });
  }

  const status = req.query.status === "ended" ? "ended" : "live";
  const propertyFilter = {
    ...activePropertyFilter,
    ...(status === "ended" ? buildEndedStageFilter() : buildLiveStageFilter()),
  };

  if (!isAdmin) {
    propertyFilter.sellerId = req.user._id;
  }

  const properties = filterPropertiesForMonitorStage(
    await Property.find(propertyFilter)
      .select(liveMonitorPropertyFields)
      .sort(
        status === "ended"
          ? { auctionEndDateTime: -1, createdAt: -1 }
          : { auctionEndDateTime: 1, createdAt: -1 },
      )
      .lean(),
    status,
  );

  const data = sortBidMonitorItems(
    await buildBidMonitorItems(properties),
    status,
  );

  res.json({ success: true, data });
};

module.exports = {
  placeBid,
  getMyBids,
  getLiveBidMonitor,
};
