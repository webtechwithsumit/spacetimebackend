const User = require("../models/User");
const { ALL_ROLES, isValidRole } = require("../constants/roles");
const { hashPassword, sanitizeUser } = require("../utils/auth");
const { normalizePhone, isValidPhone } = require("../utils/phone");
const { isValidObjectId } = require("../utils/validateId");

const createByAdmin = async (req, res) => {
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

  if (!isValidRole(role)) {
    return res.status(400).json({
      success: false,
      message: `role must be one of: ${ALL_ROLES.join(", ")}`,
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

  let user;
  try {
    user = await User.create({
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

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: sanitizeUser(user.toObject()),
  });
};

const getAll = async (req, res) => {
  const users = await User.find().lean();
  res.json({ success: true, data: users });
};

const getById = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }
  const user = await User.findById(id).lean();
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, data: user });
};

/**
 * Save: id exist karti h to 1 query me update, nahi to create.
 */
const save = async (req, res) => {
  const { id, name, email } = req.body;
  if (!name || !email) {
    return res
      .status(400)
      .json({ success: false, message: "name and email required" });
  }
  const payload = { name: name.trim(), email: email.trim() };

  if (id) {
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id" });
    }
    const user = await User.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).lean();
    if (user) return res.json({ success: true, data: user, created: false });
  }

  return res.status(400).json({
    success: false,
    message: "Use POST /api/auth/register to create a new user",
  });
};

const remove = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }
  const user = await User.findByIdAndDelete(id);
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, message: "User deleted" });
};

module.exports = { createByAdmin, getAll, getById, save, remove };
