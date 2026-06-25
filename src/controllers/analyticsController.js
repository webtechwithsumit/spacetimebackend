const AnalyticsEvent = require("../models/AnalyticsEvent");
const mongoose = require("mongoose");
const Bid = require("../models/Bid");
const Property = require("../models/Property");
const User = require("../models/User");
const {
  buildLiveAuctionsFilter,
} = require("../middleware/requirePropertyManager");
const {
  buildLiveStageFilter,
  buildEndedStageFilter,
  buildUpcomingStageFilter,
} = require("../utils/auctionStageHelpers");
const { recordAnalyticsEvent } = require("../utils/recordAnalyticsEvent");
const { buildPaginationMeta, parsePagination } = require("../utils/pagination");
const { isValidObjectId } = require("../utils/validateId");

const activePropertyFilter = { isDeleted: { $ne: true } };
const ALLOWED_EVENTS = new Set([
  "page_view",
  "auction_viewed",
  "bid_placed",
  "signup_completed",
  "login",
  "property_created",
  "logout",
  "click",
]);

function parseDateRange(query) {
  const now = new Date();
  const from = query.from ? new Date(query.from) : new Date(now);
  if (!query.from) {
    from.setDate(from.getDate() - 30);
  }
  from.setHours(0, 0, 0, 0);

  const to = query.to ? new Date(query.to) : new Date(now);
  to.setHours(23, 59, 59, 999);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return { error: "Invalid date range" };
  }

  return { from, to };
}

function sanitizeProperties(properties) {
  if (
    !properties ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  ) {
    return {};
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof key !== "string" || key.length > 64) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = typeof value === "string" ? value.slice(0, 200) : value;
    }
  }
  return sanitized;
}

const trackEvents = async (req, res) => {
  const payload = req.body?.events ?? req.body?.event ?? req.body;
  const events = Array.isArray(payload)
    ? payload
    : payload?.event
      ? [payload]
      : [];

  if (!events.length) {
    return res.status(400).json({
      success: false,
      message: "At least one analytics event is required",
    });
  }

  if (events.length > 50) {
    return res.status(400).json({
      success: false,
      message: "Too many events in one request",
    });
  }

  const userAgent = req.headers["user-agent"];
  const docs = [];

  for (const item of events) {
    const event = String(item?.event ?? "").trim();
    if (!ALLOWED_EVENTS.has(event)) continue;

    docs.push({
      event,
      properties: sanitizeProperties(item?.properties),
      userId: req.user?._id,
      sessionId: item?.sessionId
        ? String(item.sessionId).slice(0, 128)
        : undefined,
      path: item?.path ? String(item.path).slice(0, 512) : undefined,
      userAgent,
    });
  }

  if (!docs.length) {
    return res.status(400).json({
      success: false,
      message: "No valid analytics events provided",
    });
  }

  await AnalyticsEvent.insertMany(docs, { ordered: false });

  res.status(201).json({
    success: true,
    message: "Events recorded",
    data: { count: docs.length },
  });
};

const getOverview = async (req, res) => {
  const range = parseDateRange(req.query);
  if (range.error) {
    return res.status(400).json({ success: false, message: range.error });
  }

  const { from, to } = range;
  const dateMatch = { createdAt: { $gte: from, $lte: to } };

  const [
    totalUsers,
    totalBuyers,
    totalSellers,
    totalBrokers,
    totalAdmins,
    totalProperties,
    liveAuctions,
    totalBids,
    newUsersInRange,
    newBidsInRange,
    avgBidInRange,
    liveListings,
    upcomingListings,
    endedListings,
    draftListings,
    bidsOverTime,
    usersOverTime,
    usersByRole,
    bidsByCity,
    bidsByCategory,
    topAuctions,
    eventsOverTime,
    eventCounts,
    auctionViews,
    bidPlacedEvents,
    clickEvents,
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
    User.countDocuments(dateMatch),
    Bid.countDocuments(dateMatch),
    Bid.aggregate([
      { $match: dateMatch },
      { $group: { _id: null, avg: { $avg: "$amount" } } },
    ]),
    Property.countDocuments({
      ...activePropertyFilter,
      ...buildLiveStageFilter(),
    }),
    Property.countDocuments({
      ...activePropertyFilter,
      ...buildUpcomingStageFilter(),
    }),
    Property.countDocuments({
      ...activePropertyFilter,
      ...buildEndedStageFilter(),
    }),
    Property.countDocuments({
      ...activePropertyFilter,
      auctionStatus: "Draft",
    }),
    Bid.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Bid.aggregate([
      { $match: dateMatch },
      {
        $lookup: {
          from: "properties",
          localField: "propertyId",
          foreignField: "_id",
          as: "property",
        },
      },
      { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ["$property.city", ""] } }, 0] },
              "$property.city",
              "Unknown",
            ],
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Bid.aggregate([
      { $match: dateMatch },
      {
        $lookup: {
          from: "properties",
          localField: "propertyId",
          foreignField: "_id",
          as: "property",
        },
      },
      { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            $cond: [
              {
                $gt: [
                  { $strLenCP: { $ifNull: ["$property.category", ""] } },
                  0,
                ],
              },
              "$property.category",
              "Unknown",
            ],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Bid.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: "$propertyId",
          bidCount: { $sum: 1 },
          topBid: { $max: "$amount" },
        },
      },
      { $sort: { bidCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "properties",
          localField: "_id",
          foreignField: "_id",
          as: "property",
        },
      },
      { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          propertyId: { $toString: "$_id" },
          title: { $ifNull: ["$property.title", "Unknown property"] },
          city: { $ifNull: ["$property.city", ""] },
          bidCount: 1,
          topBid: 1,
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            event: "$event",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: dateMatch },
      { $group: { _id: "$event", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AnalyticsEvent.countDocuments({
      ...dateMatch,
      event: "auction_viewed",
    }),
    AnalyticsEvent.countDocuments({
      ...dateMatch,
      event: "bid_placed",
    }),
    AnalyticsEvent.countDocuments({
      ...dateMatch,
      event: "click",
    }),
  ]);

  const avgBidAmount = avgBidInRange[0]?.avg
    ? Math.round(avgBidInRange[0].avg)
    : 0;

  const viewToBidRate =
    auctionViews > 0
      ? Math.round((bidPlacedEvents / auctionViews) * 1000) / 10
      : 0;

  res.json({
    success: true,
    data: {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      summary: {
        totalUsers,
        totalBuyers,
        totalSellers,
        totalBrokers,
        totalAdmins,
        totalProperties,
        liveAuctions,
        totalBids,
        newUsersInRange,
        newBidsInRange,
        avgBidAmount,
        auctionViews,
        bidPlacedEvents,
        clickEvents,
        viewToBidRate,
      },
      propertyStats: {
        live: liveListings,
        upcoming: upcomingListings,
        ended: endedListings,
        draft: draftListings,
      },
      bidsOverTime: bidsOverTime.map((row) => ({
        date: row._id,
        count: row.count,
        totalAmount: row.totalAmount,
      })),
      usersOverTime: usersOverTime.map((row) => ({
        date: row._id,
        count: row.count,
      })),
      usersByRole: usersByRole.map((row) => ({
        role: row._id || "Unknown",
        count: row.count,
      })),
      bidsByCity: bidsByCity.map((row) => ({
        city: row._id,
        count: row.count,
        totalAmount: row.totalAmount,
      })),
      bidsByCategory: bidsByCategory.map((row) => ({
        category: row._id,
        count: row.count,
      })),
      topAuctions,
      eventsOverTime: eventsOverTime.map((row) => ({
        date: row._id.date,
        event: row._id.event,
        count: row.count,
      })),
      eventCounts: eventCounts.reduce((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {}),
    },
  });
};

function buildActivityFilter(query, range) {
  const filter = { createdAt: { $gte: range.from, $lte: range.to } };

  if (query.userId) {
    if (!isValidObjectId(query.userId)) {
      return { error: "Invalid user id" };
    }
    filter.userId = new mongoose.Types.ObjectId(query.userId);
  }

  if (query.sessionId) {
    filter.sessionId = String(query.sessionId).slice(0, 128);
  }

  if (query.event) {
    filter.event = String(query.event).trim();
  }

  if (!query.userId && !query.sessionId) {
    return { error: "userId or sessionId is required" };
  }

  return { filter };
}

const getUserActivity = async (req, res) => {
  const range = parseDateRange(req.query);
  if (range.error) {
    return res.status(400).json({ success: false, message: range.error });
  }

  const activityFilter = buildActivityFilter(req.query, range);
  if (activityFilter.error) {
    return res
      .status(400)
      .json({ success: false, message: activityFilter.error });
  }

  const { page, limit, skip } = parsePagination(req.query);
  const { filter } = activityFilter;

  const [total, timeline, user, journeyRows, topClickRows, summaryRows] =
    await Promise.all([
      AnalyticsEvent.countDocuments(filter),
      AnalyticsEvent.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      req.query.userId && isValidObjectId(req.query.userId)
        ? User.findById(req.query.userId)
            .select("name email role phone createdAt")
            .lean()
        : null,
      AnalyticsEvent.aggregate([
        { $match: { ...filter, event: "page_view" } },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: "$path",
            firstSeen: { $first: "$createdAt" },
            lastSeen: { $last: "$createdAt" },
            views: { $sum: 1 },
          },
        },
        { $sort: { firstSeen: 1 } },
        { $limit: 50 },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { ...filter, event: "click" } },
        {
          $group: {
            _id: {
              label: {
                $ifNull: [
                  "$properties.analyticsId",
                  {
                    $ifNull: [
                      "$properties.text",
                      {
                        $ifNull: ["$properties.href", "$properties.tag"],
                      },
                    ],
                  },
                ],
              },
              href: { $ifNull: ["$properties.href", ""] },
              path: { $ifNull: ["$path", ""] },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      AnalyticsEvent.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$event",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  const summary = summaryRows.reduce(
    (acc, row) => {
      acc.totalEvents += row.count;
      if (row._id === "click") acc.clicks = row.count;
      if (row._id === "page_view") acc.pageViews = row.count;
      if (row._id === "auction_viewed") acc.auctionViews = row.count;
      if (row._id === "bid_placed") acc.bids = row.count;
      return acc;
    },
    {
      totalEvents: 0,
      clicks: 0,
      pageViews: 0,
      auctionViews: 0,
      bids: 0,
    },
  );

  res.json({
    success: true,
    data: {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      user: user
        ? {
            id: String(user._id),
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            createdAt: user.createdAt,
          }
        : null,
      sessionId: req.query.sessionId ? String(req.query.sessionId) : null,
      summary,
      journey: journeyRows.map((row) => ({
        path: row._id || "Unknown",
        firstSeen: row.firstSeen,
        lastSeen: row.lastSeen,
        views: row.views,
      })),
      topClicks: topClickRows.map((row) => ({
        label: row._id.label || "Unknown",
        href: row._id.href || "",
        path: row._id.path || "",
        count: row.count,
      })),
      timeline: timeline.map((row) => ({
        id: String(row._id),
        event: row.event,
        properties: row.properties ?? {},
        path: row.path ?? "",
        sessionId: row.sessionId ?? "",
        userId: row.userId ? String(row.userId) : null,
        createdAt: row.createdAt,
      })),
      pagination: buildPaginationMeta(page, limit, total),
    },
  });
};

const getActivityUsers = async (req, res) => {
  const range = parseDateRange(req.query);
  if (range.error) {
    return res.status(400).json({ success: false, message: range.error });
  }

  const { page, limit, skip } = parsePagination(req.query);
  const search = String(req.query.search ?? "").trim();
  const dateMatch = { createdAt: { $gte: range.from, $lte: range.to } };

  const pipeline = [
    {
      $match: {
        ...dateMatch,
        userId: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$userId",
        totalEvents: { $sum: 1 },
        clicks: {
          $sum: { $cond: [{ $eq: ["$event", "click"] }, 1, 0] },
        },
        pageViews: {
          $sum: { $cond: [{ $eq: ["$event", "page_view"] }, 1, 0] },
        },
        lastActivityAt: { $max: "$createdAt" },
        firstActivityAt: { $min: "$createdAt" },
        sessions: { $addToSet: "$sessionId" },
      },
    },
    { $sort: { lastActivityAt: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
  ];

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { "user.name": { $regex: search, $options: "i" } },
          { "user.email": { $regex: search, $options: "i" } },
          { "user.phone": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  const countPipeline = [...pipeline, { $count: "total" }];
  pipeline.push({ $skip: skip }, { $limit: limit });

  const [countResult, rows] = await Promise.all([
    AnalyticsEvent.aggregate(countPipeline),
    AnalyticsEvent.aggregate(pipeline),
  ]);

  const total = countResult[0]?.total ?? 0;

  res.json({
    success: true,
    data: rows.map((row) => ({
      userId: String(row._id),
      name: row.user.name,
      email: row.user.email,
      role: row.user.role,
      phone: row.user.phone,
      totalEvents: row.totalEvents,
      clicks: row.clicks,
      pageViews: row.pageViews,
      sessionCount: row.sessions.filter(Boolean).length,
      firstActivityAt: row.firstActivityAt,
      lastActivityAt: row.lastActivityAt,
    })),
    pagination: buildPaginationMeta(page, limit, total),
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
  });
};

const getActivitySessions = async (req, res) => {
  const range = parseDateRange(req.query);
  if (range.error) {
    return res.status(400).json({ success: false, message: range.error });
  }

  const { page, limit, skip } = parsePagination(req.query);
  const dateMatch = { createdAt: { $gte: range.from, $lte: range.to } };

  const pipeline = [
    {
      $match: {
        ...dateMatch,
        sessionId: { $exists: true, $nin: [null, ""] },
        $or: [{ userId: { $exists: false } }, { userId: null }],
      },
    },
    {
      $group: {
        _id: "$sessionId",
        totalEvents: { $sum: 1 },
        clicks: {
          $sum: { $cond: [{ $eq: ["$event", "click"] }, 1, 0] },
        },
        pageViews: {
          $sum: { $cond: [{ $eq: ["$event", "page_view"] }, 1, 0] },
        },
        lastActivityAt: { $max: "$createdAt" },
        firstActivityAt: { $min: "$createdAt" },
        lastPath: { $last: "$path" },
      },
    },
    { $sort: { lastActivityAt: -1 } },
  ];

  const countPipeline = [...pipeline, { $count: "total" }];
  const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

  const [countResult, rows] = await Promise.all([
    AnalyticsEvent.aggregate(countPipeline),
    AnalyticsEvent.aggregate(dataPipeline),
  ]);

  const total = countResult[0]?.total ?? 0;

  res.json({
    success: true,
    data: rows.map((row) => ({
      sessionId: row._id,
      totalEvents: row.totalEvents,
      clicks: row.clicks,
      pageViews: row.pageViews,
      lastPath: row.lastPath || "",
      firstActivityAt: row.firstActivityAt,
      lastActivityAt: row.lastActivityAt,
    })),
    pagination: buildPaginationMeta(page, limit, total),
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
  });
};

module.exports = {
  trackEvents,
  getOverview,
  getUserActivity,
  getActivityUsers,
  getActivitySessions,
};
