const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config");

const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.sub).lean();
    if (user) req.user = user;
  } catch {
    // Ignore invalid tokens for public routes.
  }

  next();
};

module.exports = optionalAuthenticate;
