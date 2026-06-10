function isAdminRole(role) {
  return role === "Admin" || role === "Super-Admin";
}

function canManageProperties(role) {
  return role === "Seller" || isAdminRole(role);
}

function canModifyProperty(user, property) {
  if (!user || !property) return false;
  if (isAdminRole(user.role)) return true;
  return String(property.sellerId) === String(user._id);
}

const requirePropertyManager = (req, res, next) => {
  if (!canManageProperties(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Seller or Admin access required to manage properties",
    });
  }
  next();
};

module.exports = {
  requirePropertyManager,
  canManageProperties,
  canModifyProperty,
};
