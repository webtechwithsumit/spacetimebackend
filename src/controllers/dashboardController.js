const mongoose = require("mongoose");
const Property = require("../models/Property");
const Bid = require("../models/Bid");
const User = require("../models/User");
const {
  buildPropertyListFilter,
  buildLiveAuctionsFilter,
  isAdminRole,
} = require("../middleware/requirePropertyManager");
const {
  buildLiveStageFilter,
  buildEndedStageFilter,
  buildUpcomingStageFilter,
} = require("../utils/auctionStageHelpers");
const {
  getTopBidsByPropertyIds,
  attachLeadingBidderInfo,
  isAuctionEnded,
} = require("../utils/bidHelpers");

const activePropertyFilter = { isDeleted: { $ne: true } };

async function getBidSummary(userId) {
  const objectUserId = new mongoose.Types.ObjectId(userId);
  const userBidGroups = await Bid.aggregate([
    { $match: { userId: objectUserId } },
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

  if (!userBidGroups.length) {
    return {
      myBidsCount: 0,
      leadingBidsCount: 0,
      outbidCount: 0,
      endedBidsCount: 0,
      recentBids: [],
    };
  }

  const propertyIds = userBidGroups.map((group) => group._id);
  const properties = await Property.find({
    _id: { $in: propertyIds },
    ...activePropertyFilter,
  })
    .select(
      "title city microMarketLocality auctionStatus auctionEndDateTime images category",
    )
    .lean();

  const enrichedProperties = await attachLeadingBidderInfo(
    properties,
    userId,
  );
  const propertyMap = new Map(
    enrichedProperties.map((property) => [String(property._id), property]),
  );
  const topBidsByPropertyId = await getTopBidsByPropertyIds(
    propertyIds.map(String),
  );

  let leadingBidsCount = 0;
  let outbidCount = 0;
  let endedBidsCount = 0;

  const recentBids = userBidGroups.slice(0, 5).map((group) => {
    const property = propertyMap.get(String(group._id));
    const isLeading =
      property?.leadingBidderId === String(userId) &&
      property?.auctionStatus === "Live" &&
      !isAuctionEnded(property?.auctionEndDateTime);
    const ended =
      property?.auctionStatus !== "Live" ||
      isAuctionEnded(property?.auctionEndDateTime);

    if (isLeading) leadingBidsCount += 1;
    else if (!ended) outbidCount += 1;
    if (ended) endedBidsCount += 1;

    return {
      propertyId: String(group._id),
      title: property?.title ?? "Property unavailable",
      city: property?.city ?? "",
      microMarketLocality: property?.microMarketLocality ?? "",
      image: property?.images?.[0] ?? null,
      myHighestBid: group.myHighestBid,
      currentBidAmount:
        topBidsByPropertyId[String(group._id)] ?? group.myHighestBid,
      lastBidAt: group.lastBidAt,
      isLeading,
      isAuctionLive: property?.auctionStatus === "Live",
      isAuctionEnded: ended,
    };
  });

  for (const group of userBidGroups.slice(5)) {
    const property = propertyMap.get(String(group._id));
    const isLeading =
      property?.leadingBidderId === String(userId) &&
      property?.auctionStatus === "Live" &&
      !isAuctionEnded(property?.auctionEndDateTime);
    const ended =
      property?.auctionStatus !== "Live" ||
      isAuctionEnded(property?.auctionEndDateTime);

    if (isLeading) leadingBidsCount += 1;
    else if (!ended) outbidCount += 1;
    if (ended) endedBidsCount += 1;
  }

  return {
    myBidsCount: userBidGroups.length,
    leadingBidsCount,
    outbidCount,
    endedBidsCount,
    recentBids,
  };
}

async function getPropertySummary(user) {
  const filter = buildPropertyListFilter(user);

  const [total, live, upcoming, ended, draft, recentProperties] =
    await Promise.all([
      Property.countDocuments(filter),
      Property.countDocuments({ ...filter, ...buildLiveStageFilter() }),
      Property.countDocuments({ ...filter, ...buildUpcomingStageFilter() }),
      Property.countDocuments({ ...filter, ...buildEndedStageFilter() }),
      Property.countDocuments({ ...filter, auctionStatus: "Draft" }),
      Property.find(filter)
        .sort({ updatedAt: -1 })
        .limit(5)
        .select(
          "title city microMarketLocality auctionStatus auctionEndDateTime images category status updatedAt",
        )
        .lean(),
    ]);

  return {
    totalProperties: total,
    liveListings: live,
    upcomingListings: upcoming,
    endedListings: ended,
    draftListings: draft,
    recentProperties: recentProperties.map((property) => ({
      id: String(property._id),
      title: property.title,
      city: property.city ?? "",
      microMarketLocality: property.microMarketLocality ?? "",
      image: property.images?.[0] ?? null,
      auctionStatus: property.auctionStatus ?? "",
      status: property.status ?? "",
      updatedAt: property.updatedAt,
    })),
  };
}

async function getPlatformSummary() {
  const [
    totalUsers,
    totalBuyers,
    totalSellers,
    totalBrokers,
    totalAdmins,
    totalProperties,
    liveAuctions,
    totalBids,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "Buyer" }),
    User.countDocuments({ role: "Seller" }),
    User.countDocuments({ role: "Broker" }),
    User.countDocuments({ role: { $in: ["Admin", "Super-Admin"] } }),
    Property.countDocuments(activePropertyFilter),
    Property.countDocuments({
      ...activePropertyFilter,
      ...buildLiveAuctionsFilter(),
    }),
    Bid.countDocuments(),
  ]);

  return {
    totalUsers,
    totalBuyers,
    totalSellers,
    totalBrokers,
    totalAdmins,
    totalProperties,
    liveAuctions,
    totalBids,
  };
}

const getOverview = async (req, res) => {
  const user = req.user;
  const role = user.role;
  const liveAuctionsCount = await Property.countDocuments({
    ...activePropertyFilter,
    ...buildLiveAuctionsFilter(),
  });

  const payload = {
    user: {
      name: user.name,
      role: user.role,
      email: user.email,
    },
    liveAuctionsCount,
  };

  if (role === "Buyer" || role === "Broker") {
    payload.bids = await getBidSummary(user._id);
  }

  if (role === "Seller" || role === "Broker" || isAdminRole(role)) {
    payload.properties = await getPropertySummary(user);
  }

  if (isAdminRole(role)) {
    payload.platform = await getPlatformSummary();
  }

  res.json({
    success: true,
    data: payload,
  });
};

module.exports = {
  getOverview,
};
