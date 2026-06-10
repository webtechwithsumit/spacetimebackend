const { ROLES } = require('../constants/roles');

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Super-Admin access required',
    });
  }

  next();
};

module.exports = requireSuperAdmin;
