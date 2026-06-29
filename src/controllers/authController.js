const User = require("../models/User");
const {
  hashPassword,
  comparePassword,
  signToken,
  sanitizeUser,
} = require("../utils/auth");
const { normalizePhone, isValidPhone } = require("../utils/phone");
const analyticsBridge = require("../services/analyticsBridge");

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

  if (role === "Admin" || role === "Super-Admin") {
    return res.status(403).json({
      success: false,
      message:
        "Admin and Super-Admin roles can only be assigned by a Super-Admin",
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

  const normalizedPhone = normalizePhone(phone);

  const existingUser = await User.findOne({
    $or: [{ email }, { phone: normalizedPhone }],
  });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message:
        existingUser.email === email
          ? "Email already registered"
          : "Phone number already registered",
    });
  }

  const hashedPassword = await hashPassword(password);

  try {
    await User.create({
      name,
      email,
      phone: normalizedPhone,
      role,
      password: hashedPassword,
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number already registered",
      });
    }
    throw err;
  }

  await analyticsBridge.recordFromRequest(req, {
    event: "signup_completed",
    properties: { role },
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

  await analyticsBridge.recordFromRequest(req, {
    event: "login",
    properties: { role: safeUser.role },
    userId: user._id,
  });

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
