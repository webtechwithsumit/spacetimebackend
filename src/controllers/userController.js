const User = require("../models/User");
const { hashPassword, sanitizeUser } = require("../utils/auth");
const { normalizePhone, isValidPhone, phonesEqual } = require("../utils/phone");
const { normalizeAadharNo, isValidAadharNo } = require("../utils/aadhar");
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

const getBrokers = async (req, res) => {
  const brokers = await User.find({ role: "Broker" })
    .select("name email _id")
    .sort({ name: 1 })
    .lean();

  res.json({ success: true, data: brokers });
};

const getById = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }
  const user = await User.findById(id).lean();
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  res.json({ success: true, data: sanitizeUser(user) });
};

const updateByAdmin = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, role, password, image, aadharNo } = req.body;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const updates = {};

  if (name !== undefined) {
    const trimmed = name?.trim();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Name cannot be empty",
      });
    }
    updates.name = trimmed;
  }

  if (email !== undefined) {
    const trimmed = email?.trim().toLowerCase();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Email cannot be empty",
      });
    }
    if (trimmed !== user.email) {
      const existing = await User.findOne({
        email: trimmed,
        _id: { $ne: user._id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Email already registered",
        });
      }
    }
    updates.email = trimmed;
  }

  if (phone !== undefined) {
    const trimmed = phone?.trim();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Phone cannot be empty",
      });
    }
    if (!isValidPhone(trimmed)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid phone number. Use a valid 10-digit Indian mobile number",
      });
    }
    const normalizedPhone = normalizePhone(trimmed);
    if (!phonesEqual(normalizedPhone, user.phone)) {
      const existing = await User.findOne({
        phone: normalizedPhone,
        _id: { $ne: user._id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Phone number already registered",
        });
      }
    }
    updates.phone = normalizedPhone;
  }

  if (role !== undefined) {
    const trimmed = role?.trim();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Role cannot be empty",
      });
    }
    updates.role = trimmed;
  }

  if (image !== undefined) {
    updates.image = image?.trim() ?? "";
  }

  if (aadharNo !== undefined) {
    const trimmed = aadharNo?.trim() ?? "";
    if (trimmed && !isValidAadharNo(trimmed)) {
      return res.status(400).json({
        success: false,
        message: "Aadhar number must be 12 digits",
      });
    }
    updates.aadharNo = trimmed ? normalizeAadharNo(trimmed) : "";
  }

  if (password !== undefined && password !== "") {
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }
    updates.password = await hashPassword(password);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided to update",
    });
  }

  try {
    const updated = await User.findByIdAndUpdate(user._id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    res.json({
      success: true,
      message: "User updated successfully",
      data: sanitizeUser(updated),
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyPattern?.email ? "Email" : "Phone number";
      return res.status(400).json({
        success: false,
        message: `${field} already registered`,
      });
    }
    throw err;
  }
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

module.exports = {
  createByAdmin,
  getAll,
  getBrokers,
  getById,
  updateByAdmin,
  save,
  remove,
};
