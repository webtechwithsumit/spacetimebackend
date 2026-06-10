const User = require("../models/User");
const { isPublicRegisterRole, isAdminRole } = require("../constants/roles");
const {
  hashPassword,
  comparePassword,
  signToken,
  sanitizeUser,
} = require("../utils/auth");
const { normalizePhone, isValidPhone } = require("../utils/phone");

const register = async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const phone = req.body.phone?.trim();
  const role = req.body.role?.trim();
  const password = req.body.password;

  if (!name || !email || !phone || !role || !password) {
    return res.status(400).json({
      success: false,
      message: "name, email, phone, role and password are required",
    });
  }

  if (isAdminRole(role)) {
    return res.status(403).json({
      success: false,
      message:
        "Admin and Super-Admin roles can only be assigned by a Super-Admin",
    });
  }

  if (!isPublicRegisterRole(role)) {
    return res.status(400).json({
      success: false,
      message: "role must be one of: Buyer, Seller, Broker",
    });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid phone number. Use a valid 10-digit Indian mobile number",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters",
    });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "Email already registered",
    });
  }

  const hashedPassword = await hashPassword(password);
  await User.create({
    name,
    email,
    phone: normalizePhone(phone),
    role,
    password: hashedPassword,
  });

  res.status(201).json({
    success: true,
    message: "Account created successfully",
  });
};

const login = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "email and password are required",
    });
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const safeUser = sanitizeUser(user.toObject());
  const token = signToken(user._id.toString());

  res.json({
    success: true,
    message: "Login successful",
    data: {
      user: safeUser,
      token,
    },
  });
};

module.exports = { register, login };
