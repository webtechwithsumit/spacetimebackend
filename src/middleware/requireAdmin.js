function isAdminRole(role) {
  return role === "Admin" || role === "Super-Admin";
}

const requireAdmin = (req, res, next) => {
  if (!isAdminRole(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Admin or Super-Admin access required",
    });
  }
  next();
};

module.exports = { requireAdmin, isAdminRole };
