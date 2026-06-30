const mongoose = require("mongoose");
const Bid = require("../../../models/Bid");
const Property = require("../../../models/Property");
const User = require("../../../models/User");
const {
  buildLiveAuctionsFilter,
} = require("../../../middleware/requirePropertyManager");
const {
  buildLiveStageFilter,
  buildEndedStageFilter,
  buildUpcomingStageFilter,
} = require("../../../utils/auctionStageHelpers");
const { recordAnalyticsEvent } = require("../utils/recordAnalyticsEvent");
const { buildPaginationMeta, parsePagination } = require("../../../utils/pagination");
const { isValidObjectId } = require("../../../utils/validateId");
const {
  resolveEventPropertyId,
  buildPropertyAnalyticsFilter,
  buildPropertyViewFilter,
} = require("../utils/propertyAnalyticsHelpers");
const {
  isAdminRole,
  isPropertyOwner,
} = require("../../../middleware/requirePropertyManager");
const {
  buildClientMetadata,
  mapClientFields,
  formatLocation,
} = require("../utils/clientMetadata");
const { getAnalyticsEventModel } = require("../db");
const {
  getAnalyticsStatus,
} = require("../services/licenseService");
const {
  getUserAnalyticsAccess,
  hasPropertyAnalyticsAccess,
  listSubscriptions,
  activateSubscription,
  deactivateSubscription,
} = require("../services/subscriptionService");

function AnalyticsEvent() {
  return getAnalyticsEventModel();
}

async function mapTimelineUsers(timeline) {
  const userIds = [
    ...new Set(
      timeline.filter((row) => row.userId).map((row) => String(row.userId)),
    ),
  ];

  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("name email role")
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return timeline.map((row) => ({
    id: String(row._id),
    event: row.event,
    properties: row.properties ?? {},
    path: row.path ?? "",
    sessionId: row.sessionId ?? "",
    userId: row.userId
      ? {
          id: String(row.userId),
          name: userMap.get(String(row.userId))?.name ?? "",
          email: userMap.get(String(row.userId))?.email ?? "",
          role: userMap.get(String(row.userId))?.role ?? "",
        }
      : null,
    createdAt: row.createdAt,
    client: mapClientFields(row),
  }));
}

async function mapSimpleTimeline(timeline) {
  return timeline.map((row) => ({
    id: String(row._id),
    event: row.event,
    properties: row.properties ?? {},
    path: row.path ?? "",
    sessionId: row.sessionId ?? "",
    userId: row.userId ? String(row.userId) : null,
    createdAt: row.createdAt,
    client: mapClientFields(row),
  }));
}

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
  "property_card_click",
  "property_search",
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
  const clientMetadata = buildClientMetadata(req, req.body?.clientContext);
  const docs = [];

  for (const item of events) {
    const event = String(item?.event ?? "").trim();
    if (!ALLOWED_EVENTS.has(event)) continue;

    const itemClientMetadata = buildClientMetadata(
      req,
      item?.clientContext || req.body?.clientContext,
    );

    docs.push({
      event,
      properties: sanitizeProperties(item?.properties),
      userId: req.user?._id,
      propertyId: resolveEventPropertyId(item),
      sessionId: item?.sessionId
        ? String(item.sessionId).slice(0, 128)
        : undefined,
      path: item?.path ? String(item.path).slice(0, 512) : undefined,
      userAgent: itemClientMetadata.userAgent || userAgent,
      ...itemClientMetadata,
    });
  }

  if (!docs.length) {
    return res.status(400).json({
      success: false,
      message: "No valid analytics events provided",
    });
  }

  await AnalyticsEvent().insertMany(docs, { ordered: false });

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
    AnalyticsEvent().aggregate([
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
    AnalyticsEvent().aggregate([
      { $match: dateMatch },
      { $group: { _id: "$event", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AnalyticsEvent().countDocuments({
      ...dateMatch,
      event: "auction_viewed",
    }),
    AnalyticsEvent().countDocuments({
      ...dateMatch,
      event: "bid_placed",
    }),
    AnalyticsEvent().countDocuments({
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

  if (query.ip) {
    filter.ipAddress = String(query.ip).trim().slice(0, 45);
  }

  if (query.deviceType) {
    filter.deviceType = String(query.deviceType).trim();
  }

  if (!query.userId && !query.sessionId) {
    return { error: "userId or sessionId is required" };
  }

  return { filter };
}

function mapTimelineRow(row) {
  return {
    id: String(row._id),
    event: row.event,
    properties: row.properties ?? {},
    path: row.path ?? "",
    sessionId: row.sessionId ?? "",
    userId: row.userId ? String(row.userId) : null,
    createdAt: row.createdAt,
    client: mapClientFields(row),
  };
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
    AnalyticsEvent().countDocuments(filter),
    AnalyticsEvent().find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    req.query.userId && isValidObjectId(req.query.userId)
      ? User.findById(req.query.userId)
          .select("name email role phone createdAt")
          .lean()
      : null,
    AnalyticsEvent().aggregate([
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
    AnalyticsEvent().aggregate([
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
    AnalyticsEvent().aggregate([
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
      timeline: await mapSimpleTimeline(timeline),
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

  let userIdFilter = { userId: { $exists: true, $ne: null } };

  if (search) {
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    })
      .select("_id")
      .lean();

    const matchingIds = matchingUsers.map((user) => user._id);
    if (!matchingIds.length) {
      return res.json({
        success: true,
        data: [],
        pagination: buildPaginationMeta(page, limit, 0),
        range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
    }

    userIdFilter = { userId: { $in: matchingIds } };
  }

  const pipeline = [
    {
      $match: {
        ...dateMatch,
        ...userIdFilter,
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
  ];

  const countPipeline = [...pipeline, { $count: "total" }];
  pipeline.push({ $skip: skip }, { $limit: limit });

  const [countResult, rows] = await Promise.all([
    AnalyticsEvent().aggregate(countPipeline),
    AnalyticsEvent().aggregate(pipeline),
  ]);

  const total = countResult[0]?.total ?? 0;
  const userIds = rows.map((row) => row._id);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("name email role phone")
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  res.json({
    success: true,
    data: rows.map((row) => {
      const user = userMap.get(String(row._id));
      return {
        userId: String(row._id),
        name: user?.name ?? "Unknown user",
        email: user?.email ?? "",
        role: user?.role ?? "",
        phone: user?.phone ?? "",
        totalEvents: row.totalEvents,
        clicks: row.clicks,
        pageViews: row.pageViews,
        sessionCount: row.sessions.filter(Boolean).length,
        firstActivityAt: row.firstActivityAt,
        lastActivityAt: row.lastActivityAt,
      };
    }),
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
    AnalyticsEvent().aggregate(countPipeline),
    AnalyticsEvent().aggregate(dataPipeline),
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

const getPropertyAnalytics = async (req, res) => {
  const { propertyId } = req.params;
  if (!isValidObjectId(propertyId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid property id" });
  }

  const property = await Property.findOne({
    _id: propertyId,
    ...activePropertyFilter,
  })
    .select(
      "title city category buildingType microMarketLocality auctionStatus status sellerId",
    )
    .populate("sellerId", "name email role")
    .lean();

  if (!property) {
    return res
      .status(404)
      .json({ success: false, message: "Property not found" });
  }

  const canAccess =
    isAdminRole(req.user?.role) ||
    ((await hasPropertyAnalyticsAccess(req.user)) &&
      isPropertyOwner(req.user, property));
  if (!canAccess) {
    return res.status(403).json({
      success: false,
      message: isPropertyOwner(req.user, property)
        ? "Property analytics requires an active analytics subscription"
        : "You do not have access to this property analytics",
    });
  }

  const range = parseDateRange(req.query);
  if (range.error) {
    return res.status(400).json({ success: false, message: range.error });
  }

  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildPropertyAnalyticsFilter(propertyId, range);
  const viewFilter = buildPropertyViewFilter(propertyId, range);
  const propertyPath = `/auctions/${propertyId}`;

  const [
    totalEvents,
    timeline,
    viewsOverTime,
    topClickRows,
    eventSummaryRows,
    bidCount,
    viewSessions,
    cardClickCount,
    pageClickCount,
    visitorRows,
    searchBeforeViewRows,
    categoryInterestRows,
    trafficSourceRows,
    nextPageRows,
  ] = await Promise.all([
    AnalyticsEvent().countDocuments(filter),
    AnalyticsEvent().find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AnalyticsEvent().aggregate([
      { $match: viewFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          visitors: {
            $addToSet: {
              $ifNull: [{ $toString: "$userId" }, "$sessionId"],
            },
          },
        },
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          uniqueVisitors: { $size: "$visitors" },
        },
      },
      { $sort: { date: 1 } },
    ]),
    AnalyticsEvent().aggregate([
      {
        $match: {
          ...filter,
          event: "click",
        },
      },
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
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    AnalyticsEvent().aggregate([
      { $match: filter },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]),
    Bid.countDocuments({
      propertyId,
      createdAt: { $gte: range.from, $lte: range.to },
    }),
    AnalyticsEvent().aggregate([
      { $match: viewFilter },
      {
        $group: {
          _id: {
            $ifNull: [{ $toString: "$userId" }, "$sessionId"],
          },
          isRegistered: {
            $max: {
              $cond: [{ $ifNull: ["$userId", false] }, 1, 0],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          uniqueVisitors: { $sum: 1 },
          registeredVisitors: {
            $sum: "$isRegistered",
          },
        },
      },
    ]),
    AnalyticsEvent().countDocuments({
      ...filter,
      event: "property_card_click",
    }),
    AnalyticsEvent().countDocuments({
      ...filter,
      event: "click",
      path: { $regex: `^/auctions/${propertyId}(/|$)` },
    }),
    AnalyticsEvent().aggregate([
      { $match: viewFilter },
      {
        $group: {
          _id: {
            visitorKey: {
              $ifNull: [{ $toString: "$userId" }, "$sessionId"],
            },
            userId: "$userId",
            sessionId: "$sessionId",
          },
          views: { $sum: 1 },
          firstSeen: { $min: "$createdAt" },
          lastSeen: { $max: "$createdAt" },
        },
      },
      { $sort: { lastSeen: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: "users",
          localField: "_id.userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "analyticevents",
          let: {
            visitorKey: "$_id.visitorKey",
            userId: "$_id.userId",
            sessionId: "$_id.sessionId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $gte: ["$createdAt", range.from],
                    },
                    {
                      $lte: ["$createdAt", range.to],
                    },
                    {
                      $or: [
                        {
                          $and: [
                            { $ne: ["$$userId", null] },
                            { $eq: ["$userId", "$$userId"] },
                          ],
                        },
                        {
                          $and: [
                            { $ne: ["$$sessionId", null] },
                            { $eq: ["$sessionId", "$$sessionId"] },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            { $sort: { createdAt: 1 } },
            { $limit: 12 },
            {
              $project: {
                event: 1,
                path: 1,
                properties: 1,
                createdAt: 1,
              },
            },
          ],
          as: "journey",
        },
      },
    ]),
    AnalyticsEvent().aggregate([
      { $match: viewFilter },
      {
        $project: {
          sessionId: 1,
          viewedAt: "$createdAt",
        },
      },
      {
        $lookup: {
          from: "analyticevents",
          let: { sessionId: "$sessionId", viewedAt: "$viewedAt" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$sessionId", "$$sessionId"] },
                    { $eq: ["$event", "property_search"] },
                    { $lt: ["$createdAt", "$$viewedAt"] },
                    { $gte: ["$createdAt", range.from] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "search",
        },
      },
      { $unwind: { path: "$search", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: {
            query: { $ifNull: ["$search.properties.query", ""] },
            category: { $ifNull: ["$search.properties.category", ""] },
            city: { $ifNull: ["$search.properties.city", ""] },
            buildingType: {
              $ifNull: ["$search.properties.buildingType", ""],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    AnalyticsEvent().aggregate([
      { $match: viewFilter },
      {
        $project: {
          sessionId: 1,
          viewedAt: "$createdAt",
        },
      },
      {
        $lookup: {
          from: "analyticevents",
          let: { sessionId: "$sessionId", viewedAt: "$viewedAt" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$sessionId", "$$sessionId"] },
                    { $eq: ["$event", "property_search"] },
                    { $lt: ["$createdAt", "$$viewedAt"] },
                    { $gte: ["$createdAt", range.from] },
                  ],
                },
              },
            },
          ],
          as: "searches",
        },
      },
      { $unwind: { path: "$searches", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: { $ifNull: ["$searches.properties.category", "Unknown"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    AnalyticsEvent().aggregate([
      { $match: viewFilter },
      {
        $lookup: {
          from: "analyticevents",
          let: { sessionId: "$sessionId", viewedAt: "$createdAt" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$sessionId", "$$sessionId"] },
                    { $eq: ["$event", "page_view"] },
                    { $lt: ["$createdAt", "$$viewedAt"] },
                    { $gte: ["$createdAt", range.from] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "referrer",
        },
      },
      { $unwind: { path: "$referrer", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: { $ifNull: ["$referrer.path", "$referrer.properties.path"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    AnalyticsEvent().aggregate([
      { $match: viewFilter },
      {
        $lookup: {
          from: "analyticevents",
          let: { sessionId: "$sessionId", viewedAt: "$createdAt" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$sessionId", "$$sessionId"] },
                    { $eq: ["$event", "page_view"] },
                    { $gt: ["$createdAt", "$$viewedAt"] },
                    { $lte: ["$createdAt", range.to] },
                    {
                      $not: {
                        $regexMatch: {
                          input: { $ifNull: ["$path", ""] },
                          regex: `^/auctions/${propertyId}(/|$)`,
                        },
                      },
                    },
                  ],
                },
              },
            },
            { $sort: { createdAt: 1 } },
            { $limit: 1 },
          ],
          as: "nextPage",
        },
      },
      { $unwind: { path: "$nextPage", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: {
            $ifNull: ["$nextPage.path", "$nextPage.properties.path"],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const eventSummary = eventSummaryRows.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  const totalViews = eventSummary.auction_viewed ?? 0;
  const uniqueVisitors = viewSessions[0]?.uniqueVisitors ?? 0;
  const registeredVisitors = viewSessions[0]?.registeredVisitors ?? 0;
  const guestVisitors = Math.max(uniqueVisitors - registeredVisitors, 0);
  const viewToBidRate =
    totalViews > 0 ? Math.round((bidCount / totalViews) * 1000) / 10 : 0;

  res.json({
    success: true,
    data: {
      property: {
        id: String(property._id),
        title: property.title,
        city: property.city ?? "",
        category: property.category ?? "",
        buildingType: property.buildingType ?? "",
        microMarketLocality: property.microMarketLocality ?? "",
        auctionStatus: property.auctionStatus ?? "",
        status: property.status ?? "",
        seller: property.sellerId
          ? {
              id: String(property.sellerId._id ?? property.sellerId),
              name: property.sellerId.name ?? "",
              email: property.sellerId.email ?? "",
            }
          : null,
      },
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary: {
        uniqueVisitors,
        registeredVisitors,
        guestVisitors,
        totalViews,
        cardClicks: cardClickCount,
        pageClicks: pageClickCount,
        totalClicks: eventSummary.click ?? 0,
        bidsPlaced: bidCount,
        viewToBidRate,
        totalEvents,
      },
      viewsOverTime: viewsOverTime.map((row) => ({
        date: row.date,
        count: row.count,
        uniqueVisitors: row.uniqueVisitors,
      })),
      topClicks: topClickRows.map((row) => ({
        label: row._id.label || "Unknown",
        href: row._id.href || "",
        count: row.count,
      })),
      trafficSources: trafficSourceRows.map((row) => ({
        path: row._id || "Unknown",
        count: row.count,
      })),
      nextPages: nextPageRows.map((row) => ({
        path: row._id || "Unknown",
        count: row.count,
      })),
      searchesBeforeView: searchBeforeViewRows.map((row) => ({
        query: row._id.query || "",
        category: row._id.category || "",
        city: row._id.city || "",
        buildingType: row._id.buildingType || "",
        count: row.count,
      })),
      categoryInterest: categoryInterestRows.map((row) => ({
        category: row._id,
        count: row.count,
      })),
      visitors: visitorRows.map((row) => ({
        visitorKey: row._id.visitorKey,
        userId: row._id.userId ? String(row._id.userId) : null,
        sessionId: row._id.sessionId ?? "",
        name: row.user?.name ?? null,
        email: row.user?.email ?? null,
        role: row.user?.role ?? null,
        views: row.views,
        firstSeen: row.firstSeen,
        lastSeen: row.lastSeen,
        journey: (row.journey ?? []).map((step) => ({
          event: step.event,
          path: step.path ?? "",
          properties: step.properties ?? {},
          createdAt: step.createdAt,
        })),
      })),
      timeline: await mapTimelineUsers(timeline),
      pagination: buildPaginationMeta(page, limit, totalEvents),
    },
  });
};

const getStatus = async (req, res) => {
  const status = await getAnalyticsStatus();
  res.json({ success: true, data: status });
};

const getAccess = async (req, res) => {
  const status = await getAnalyticsStatus();
  const access = await getUserAnalyticsAccess(req.user);

  res.json({
    success: true,
    data: {
      platform: status,
      ...access,
    },
  });
};

const getSubscriptions = async (_req, res) => {
  const subscriptions = await listSubscriptions();
  res.json({ success: true, data: subscriptions });
};

const activateUserSubscription = async (req, res) => {
  try {
    const subscription = await activateSubscription(req.body, req.user?._id);
    res.status(201).json({
      success: true,
      message: "Analytics subscription activated for user",
      data: subscription,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to activate subscription",
    });
  }
};

const deactivateUserSubscription = async (req, res) => {
  const userId = req.body.userId?.trim();
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId is required",
    });
  }

  await deactivateSubscription(userId);
  res.json({
    success: true,
    message: "Analytics subscription deactivated for user",
  });
};

module.exports = {
  trackEvents,
  getOverview,
  getUserActivity,
  getActivityUsers,
  getActivitySessions,
  getPropertyAnalytics,
  getStatus,
  getAccess,
  getSubscriptions,
  activateUserSubscription,
  deactivateUserSubscription,
};
