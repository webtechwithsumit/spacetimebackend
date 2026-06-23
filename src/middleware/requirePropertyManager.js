function isAdminRole(role) {
  return role === "Admin" || role === "Super-Admin";
}

function canManageProperties(role) {
  return role === "Seller" || role === "Broker" || isAdminRole(role);
}

function getPropertyOwnerId(sellerId) {
  if (!sellerId) return null;
  if (typeof sellerId === "object" && sellerId._id) {
    return String(sellerId._id);
  }
  return String(sellerId);
}

function isPropertyOwner(user, property) {
  if (!user || !property) return false;
  return getPropertyOwnerId(property.sellerId) === String(user._id);
}

function canAccessPropertyList(user) {
  if (!user) return false;
  return canManageProperties(user.role);
}

function buildPropertyListFilter(user) {
  const filter = { isDeleted: { $ne: true } };
  if (!user) return filter;
  if (isAdminRole(user.role)) return filter;
  if (user.role === "Seller" || user.role === "Broker") {
    filter.sellerId = user._id;
  }
  return filter;
}

function buildLiveAuctionsFilter() {
  return {
    isDeleted: { $ne: true },
    auctionStatus: "Live",
  };
}

function isLiveAuctionProperty(property) {
  return property?.auctionStatus === "Live";
}

function canViewProperty(user, property) {
  if (!user || !property) return false;
  if (isAdminRole(user.role)) return true;
  if (user.role === "Seller" || user.role === "Broker") {
    return isPropertyOwner(user, property);
  }
  if (user.role === "Buyer") {
    return isLiveAuctionProperty(property);
  }
  return false;
}

function canModifyProperty(user, property) {
  if (!user || !property) return false;
  if (isAdminRole(user.role)) return true;
  return isPropertyOwner(user, property);
}

const requirePropertyManager = (req, res, next) => {
  if (!canManageProperties(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Seller, Broker, or Admin access required to manage properties",
    });
  }
  next();
};

module.exports = {
  requirePropertyManager,
  canManageProperties,
  canAccessPropertyList,
  buildPropertyListFilter,
  buildLiveAuctionsFilter,
  canViewProperty,
  canModifyProperty,
  isPropertyOwner,
  isAdminRole,
};
