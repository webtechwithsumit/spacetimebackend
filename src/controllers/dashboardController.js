const mongoose = require("mongoose");
const Property = require("../models/Property");
const Bid = require("../models/Bid");
const User = require("../models/User");
const Ticket = require("../models/Ticket");
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
  parseIndianNumber,
} = require("../utils/bidHelpers");
const {
  filterPropertiesForMonitorStage,
} = require("../utils/auctionStageHelpers");

const activePropertyFilter = { isDeleted: { $ne: true } };

function parseActivityDays(query) {
  const raw = String(query?.days ?? "30").trim().toLowerCase();
  if (raw === "all" || raw === "0") return 0;
  const parsed = Number(raw);
  if (parsed === 7 || parsed === 30) return parsed;
  return 30;
}

function activitySinceDate(days) {
  if (!days) return null;
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  return since;
}

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

async function getUsersWithPropertyCounts(roles) {
  const users = await User.find({ role: { $in: roles } })
    .select("name email role")
    .lean();

  if (!users.length) return [];

  const userIds = users.map((user) => user._id);

  const [counts, latestProperties] = await Promise.all([
    Property.aggregate([
      {
        $match: {
          ...activePropertyFilter,
          sellerId: { $in: userIds },
        },
      },
      { $group: { _id: "$sellerId", count: { $sum: 1 } } },
    ]),
    Property.aggregate([
      {
        $match: {
          ...activePropertyFilter,
          sellerId: { $in: userIds },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$sellerId",
          propertyId: { $first: "$_id" },
        },
      },
    ]),
  ]);

  const countMap = new Map(
    counts.map((entry) => [String(entry._id), entry.count]),
  );
  const propertyMap = new Map(
    latestProperties.map((entry) => [String(entry._id), String(entry.propertyId)]),
  );

  return users
    .map((user) => ({
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      count: countMap.get(String(user._id)) ?? 0,
      viewPropertyId: propertyMap.get(String(user._id)) ?? null,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 50);
}

async function getUsersWithBidStats(roles) {
  const users = await User.find({ role: { $in: roles } })
    .select("name email role")
    .lean();

  if (!users.length) return [];

  const userIds = users.map((user) => user._id);

  const [propertyCounts, totalBidCounts, leadingCounts] = await Promise.all([
    Bid.aggregate([
      { $match: { userId: { $in: userIds } } },
      {
        $group: {
          _id: { userId: "$userId", propertyId: "$propertyId" },
        },
      },
      { $group: { _id: "$_id.userId", count: { $sum: 1 } } },
    ]),
    Bid.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", totalBids: { $sum: 1 } } },
    ]),
    Bid.aggregate([
      { $sort: { amount: -1, createdAt: -1 } },
      {
        $group: {
          _id: "$propertyId",
          userId: { $first: "$userId" },
        },
      },
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", leadingCount: { $sum: 1 } } },
    ]),
  ]);

  const propertyCountMap = new Map(
    propertyCounts.map((entry) => [String(entry._id), entry.count]),
  );
  const totalBidMap = new Map(
    totalBidCounts.map((entry) => [String(entry._id), entry.totalBids]),
  );
  const leadingMap = new Map(
    leadingCounts.map((entry) => [String(entry._id), entry.leadingCount]),
  );

  return users
    .map((user) => ({
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      count: propertyCountMap.get(String(user._id)) ?? 0,
      totalBids: totalBidMap.get(String(user._id)) ?? 0,
      leadingCount: leadingMap.get(String(user._id)) ?? 0,
    }))
    .filter((row) => row.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.totalBids - a.totalBids ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 50);
}

async function getPropertiesInBidding(limit = 5) {
  const properties = filterPropertiesForMonitorStage(
    await Property.find({
      ...activePropertyFilter,
      ...buildLiveStageFilter(),
    })
      .select(
        "title city microMarketLocality startingBidAmount auctionEndDateTime",
      )
      .sort({ auctionEndDateTime: 1, createdAt: -1 })
      .limit(20)
      .lean(),
    "live",
  );

  if (!properties.length) return [];

  const propertyIds = properties.map((property) => property._id);
  const [topBidsByPropertyId, bidCounts, leadingBids] = await Promise.all([
    getTopBidsByPropertyIds(propertyIds.map(String)),
    Bid.aggregate([
      { $match: { propertyId: { $in: propertyIds } } },
      { $group: { _id: "$propertyId", totalBids: { $sum: 1 } } },
    ]),
    Bid.aggregate([
      { $match: { propertyId: { $in: propertyIds } } },
      { $sort: { amount: -1, createdAt: -1 } },
      {
        $group: {
          _id: "$propertyId",
          amount: { $first: "$amount" },
          userId: { $first: "$userId" },
        },
      },
    ]),
  ]);

  const bidCountMap = new Map(
    bidCounts.map((entry) => [String(entry._id), entry.totalBids]),
  );
  const leadingMap = new Map(
    leadingBids.map((entry) => [String(entry._id), entry]),
  );

  const leaderIds = leadingBids.map((entry) => entry.userId).filter(Boolean);
  const leaders = leaderIds.length
    ? await User.find({ _id: { $in: leaderIds } }).select("name").lean()
    : [];
  const leaderMap = new Map(leaders.map((user) => [String(user._id), user]));

  return properties
    .map((property) => {
      const propertyId = String(property._id);
      const leading = leadingMap.get(propertyId);
      const leader = leading ? leaderMap.get(String(leading.userId)) : null;

      return {
        propertyId,
        title: property.title,
        city: property.city ?? "",
        microMarketLocality: property.microMarketLocality ?? "",
        totalBids: bidCountMap.get(propertyId) ?? 0,
        currentBidAmount:
          topBidsByPropertyId[propertyId] ??
          parseIndianNumber(property.startingBidAmount),
        leadingBidderName: leader?.name ?? null,
        auctionEndDateTime: property.auctionEndDateTime ?? "",
      };
    })
    .sort((a, b) => b.totalBids - a.totalBids || b.currentBidAmount - a.currentBidAmount)
    .slice(0, limit);
}

async function getLatestListings(limit = 5) {
  const properties = await Property.find(activePropertyFilter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select(
      "title city microMarketLocality auctionStatus status totalPrice createdAt",
    )
    .lean();

  return properties.map((property) => ({
    id: String(property._id),
    title: property.title,
    city: property.city ?? "",
    microMarketLocality: property.microMarketLocality ?? "",
    auctionStatus: property.auctionStatus ?? "",
    status: property.status ?? "",
    totalPrice: property.totalPrice ?? "",
    createdAt: property.createdAt,
  }));
}

async function getClosedAuctions(limit = 10) {
  const properties = filterPropertiesForMonitorStage(
    await Property.find({
      ...activePropertyFilter,
      ...buildEndedStageFilter(),
    })
      .select(
        "title city microMarketLocality auctionEndDateTime startingBidAmount images",
      )
      .sort({ auctionEndDateTime: -1, createdAt: -1 })
      .limit(50)
      .lean(),
    "ended",
  );

  if (!properties.length) return [];

  const propertyIds = properties.map((property) => property._id);
  const [topBidsByPropertyId, bidCounts, winningBids] = await Promise.all([
    getTopBidsByPropertyIds(propertyIds.map(String)),
    Bid.aggregate([
      { $match: { propertyId: { $in: propertyIds } } },
      { $group: { _id: "$propertyId", totalBids: { $sum: 1 } } },
    ]),
    Bid.aggregate([
      { $match: { propertyId: { $in: propertyIds } } },
      { $sort: { amount: -1, createdAt: -1 } },
      {
        $group: {
          _id: "$propertyId",
          amount: { $first: "$amount" },
          userId: { $first: "$userId" },
        },
      },
    ]),
  ]);

  const bidCountMap = new Map(
    bidCounts.map((entry) => [String(entry._id), entry.totalBids]),
  );
  const winningMap = new Map(
    winningBids.map((entry) => [String(entry._id), entry]),
  );

  const winnerIds = winningBids.map((entry) => entry.userId).filter(Boolean);
  const winners = winnerIds.length
    ? await User.find({ _id: { $in: winnerIds } }).select("name").lean()
    : [];
  const winnerNameMap = new Map(
    winners.map((user) => [String(user._id), user.name]),
  );

  return properties.slice(0, limit).map((property) => {
    const propertyId = String(property._id);
    const winning = winningMap.get(propertyId);

    return {
      propertyId,
      title: property.title,
      city: property.city ?? "",
      microMarketLocality: property.microMarketLocality ?? "",
      image: property.images?.[0] ?? null,
      totalBids: bidCountMap.get(propertyId) ?? 0,
      winningBid:
        winning?.amount ??
        topBidsByPropertyId[propertyId] ??
        parseIndianNumber(property.startingBidAmount),
      winningBidderName: winning
        ? (winnerNameMap.get(String(winning.userId)) ?? null)
        : null,
      auctionEndDateTime: property.auctionEndDateTime ?? "",
    };
  });
}

async function getRecentPlatformActivity(limit = 8, days = 30) {
  const filter = {};
  const since = activitySinceDate(days);
  if (since) filter.createdAt = { $gte: since };

  const bids = await Bid.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  if (!bids.length) return [];

  const propertyIds = [...new Set(bids.map((bid) => String(bid.propertyId)))];
  const userIds = [...new Set(bids.map((bid) => String(bid.userId)))];

  const [properties, users] = await Promise.all([
    Property.find({ _id: { $in: propertyIds } })
      .select("title city")
      .lean(),
    User.find({ _id: { $in: userIds } }).select("name role").lean(),
  ]);

  const propertyMap = new Map(
    properties.map((property) => [String(property._id), property]),
  );
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return bids.map((bid) => {
    const property = propertyMap.get(String(bid.propertyId));
    const bidder = userMap.get(String(bid.userId));

    return {
      id: String(bid._id),
      amount: bid.amount,
      createdAt: bid.createdAt,
      userName: bidder?.name ?? "Unknown",
      userRole: bidder?.role ?? "",
      propertyId: String(bid.propertyId),
      propertyTitle: property?.title ?? "Property unavailable",
      propertyCity: property?.city ?? "",
    };
  });
}

async function getPeriodBidCount(days = 30) {
  const since = activitySinceDate(days);
  if (!since) return Bid.countDocuments();
  return Bid.countDocuments({ createdAt: { $gte: since } });
}

async function getNeedsAttention() {
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;

  const liveProperties = filterPropertiesForMonitorStage(
    await Property.find({
      ...activePropertyFilter,
      ...buildLiveStageFilter(),
    })
      .select("title auctionEndDateTime")
      .lean(),
    "live",
  );

  const propertyIds = liveProperties.map((property) => property._id);
  const bidCounts = propertyIds.length
    ? await Bid.aggregate([
        { $match: { propertyId: { $in: propertyIds } } },
        { $group: { _id: "$propertyId", count: { $sum: 1 } } },
      ])
    : [];
  const bidCountMap = new Map(
    bidCounts.map((entry) => [String(entry._id), entry.count]),
  );

  const endingSoon = liveProperties
    .filter((property) => {
      const end = new Date(property.auctionEndDateTime).getTime();
      return Number.isFinite(end) && end > now && end <= in24h;
    })
    .map((property) => ({
      propertyId: String(property._id),
      title: property.title,
      auctionEndDateTime: property.auctionEndDateTime ?? "",
    }))
    .slice(0, 5);

  const zeroBids = liveProperties
    .filter((property) => !bidCountMap.get(String(property._id)))
    .map((property) => ({
      propertyId: String(property._id),
      title: property.title,
    }))
    .slice(0, 5);

  const [openSupportTickets, draftListings] = await Promise.all([
    Ticket.countDocuments({
      ...activePropertyFilter,
      status: { $in: ["Open", "In Progress", "Waiting on User"] },
    }),
    Property.countDocuments({
      ...activePropertyFilter,
      auctionStatus: "Draft",
    }),
  ]);

  return {
    endingSoon,
    zeroBids,
    openSupportTickets,
    draftListings,
  };
}

async function getAdminInsights(days = 30) {
  const [
    brokerListings,
    sellerListings,
    buyerBids,
    adminListings,
    brokerBids,
    sellerBids,
    propertiesInBidding,
    latestListings,
    closedAuctions,
    recentActivity,
    needsAttention,
    periodBidCount,
  ] = await Promise.all([
    getUsersWithPropertyCounts(["Broker"]),
    getUsersWithPropertyCounts(["Seller"]),
    getUsersWithBidStats(["Buyer"]),
    getUsersWithPropertyCounts(["Admin", "Super-Admin"]),
    getUsersWithBidStats(["Broker"]),
    getUsersWithBidStats(["Seller"]),
    getPropertiesInBidding(5),
    getLatestListings(5),
    getClosedAuctions(10),
    getRecentPlatformActivity(8, days),
    getNeedsAttention(),
    getPeriodBidCount(days),
  ]);

  return {
    activityDays: days,
    periodBidCount,
    needsAttention,
    roleBreakdown: {
      brokerListings,
      sellerListings,
      buyerBids,
      adminListings,
      brokerBids,
      sellerBids,
    },
    propertiesInBidding,
    latestListings,
    closedAuctions,
    recentActivity,
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
    const activityDays = parseActivityDays(req.query);
    payload.platform = await getPlatformSummary();
    payload.adminInsights = await getAdminInsights(activityDays);
  }

  res.json({
    success: true,
    data: payload,
  });
};

module.exports = {
  getOverview,
};
