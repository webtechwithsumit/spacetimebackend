const AnalyticsSubscription = require("../../../models/AnalyticsSubscription");
const User = require("../../../models/User");
const { isAdminRole } = require("../../../middleware/requireAdmin");

let cache = new Map();
const CACHE_MS = 30_000;

function isSubscriptionActive(subscription) {
  if (!subscription?.enabled) return false;
  if (
    subscription.expiresAt &&
    new Date(subscription.expiresAt).getTime() < Date.now()
  ) {
    return false;
  }
  return true;
}

async function getUserSubscription(userId, forceRefresh = false) {
  const key = String(userId);
  const now = Date.now();
  const cached = cache.get(key);

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const subscription = await AnalyticsSubscription.findOne({ userId }).lean();
  cache.set(key, { value: subscription, expiresAt: now + CACHE_MS });
  return subscription;
}

function clearSubscriptionCache(userId) {
  if (userId) {
    cache.delete(String(userId));
    return;
  }
  cache = new Map();
}

async function hasPropertyAnalyticsAccess(user) {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  if (!["Seller", "Broker"].includes(user.role)) return false;

  const subscription = await getUserSubscription(user._id);
  return isSubscriptionActive(subscription);
}

async function canViewPlatformAnalytics(user) {
  return Boolean(user && isAdminRole(user.role));
}

async function getUserAnalyticsAccess(user) {
  const platformRole = user?.role ?? null;
  const canViewPlatform = await canViewPlatformAnalytics(user);
  const canViewProperty = await hasPropertyAnalyticsAccess(user);

  let subscription = null;
  if (user && ["Seller", "Broker"].includes(user.role)) {
    const record = await getUserSubscription(user._id);
    if (record) {
      subscription = {
        enabled: record.enabled,
        active: isSubscriptionActive(record),
        plan: record.plan,
        features: record.features,
        expiresAt: record.expiresAt,
        activatedAt: record.activatedAt,
      };
    }
  }

  return {
    role: platformRole,
    canViewPlatformAnalytics: canViewPlatform,
    canViewPropertyAnalytics: canViewProperty,
    subscription,
  };
}

async function listSubscriptions() {
  const subscriptions = await AnalyticsSubscription.find()
    .sort({ updatedAt: -1 })
    .lean();

  const userIds = subscriptions.map((row) => row.userId);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("name email role phone")
        .lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return subscriptions.map((row) => ({
    id: String(row._id),
    userId: String(row.userId),
    user: userMap.get(String(row.userId))
      ? {
          id: String(row.userId),
          name: userMap.get(String(row.userId)).name,
          email: userMap.get(String(row.userId)).email,
          role: userMap.get(String(row.userId)).role,
          phone: userMap.get(String(row.userId)).phone,
        }
      : null,
    enabled: row.enabled,
    active: isSubscriptionActive(row),
    plan: row.plan,
    features: row.features,
    expiresAt: row.expiresAt,
    activatedAt: row.activatedAt,
    notes: row.notes,
    updatedAt: row.updatedAt,
  }));
}

async function activateSubscription(payload, activatedBy) {
  const userId = payload.userId;
  if (!userId) {
    throw new Error("userId is required");
  }

  const user = await User.findById(userId).select("role name email").lean();
  if (!user) {
    throw new Error("User not found");
  }
  if (!["Seller", "Broker"].includes(user.role)) {
    throw new Error("Analytics subscription is only for Seller or Broker users");
  }

  const subscription = await AnalyticsSubscription.findOneAndUpdate(
    { userId },
    {
      userId,
      enabled: true,
      plan: payload.plan || "basic",
      features: ["property_analytics"],
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      notes: payload.notes?.trim() || "",
      activatedBy,
      activatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  clearSubscriptionCache(userId);
  return subscription;
}

async function deactivateSubscription(userId) {
  await AnalyticsSubscription.findOneAndUpdate(
    { userId },
    { enabled: false },
  );
  clearSubscriptionCache(userId);
}

module.exports = {
  getUserSubscription,
  hasPropertyAnalyticsAccess,
  canViewPlatformAnalytics,
  getUserAnalyticsAccess,
  listSubscriptions,
  activateSubscription,
  deactivateSubscription,
  isSubscriptionActive,
};
