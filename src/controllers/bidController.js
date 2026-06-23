const Property = require("../models/Property");
const Bid = require("../models/Bid");
const mongoose = require("mongoose");
const { isValidObjectId } = require("../utils/validateId");
const { buildLiveAuctionsFilter } = require("../middleware/requirePropertyManager");
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

module.exports = {
  placeBid,
  getMyBids,
};
