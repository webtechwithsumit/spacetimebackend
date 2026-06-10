const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "Super-Admin") {
    return res.status(403).json({
      success: false,
      message: "Super-Admin access required",
    });
  }

  next();
};

module.exports = requireSuperAdmin;
