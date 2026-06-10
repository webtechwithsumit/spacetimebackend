const User = require("../models/User");
const {
  hashPassword,
  comparePassword,
  sanitizeUser,
} = require("../utils/auth");
const { normalizePhone, isValidPhone, phonesEqual } = require("../utils/phone");
const { normalizeAadharNo, isValidAadharNo } = require("../utils/aadhar");
const {
  mergeKycDocuments,
  resolveProfileImage,
} = require("../utils/profileMedia");

const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.json({
    success: true,
    data: sanitizeUser(user),
  });
};

function normalizeMediaList(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

const updateProfile = async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    currentPassword,
    image,
    aadharNo,
    kycDocuments,
  } = req.body;

  const updates = {};
  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

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

  const entityName = updates.name ?? user.name;
  const hasNewMedia =
    req.files &&
    (req.files.image?.length || req.files.kycDocuments?.length);
  const hasExistingMedia =
    req.body.existingImage !== undefined ||
    req.body.existingKycDocuments !== undefined;

  if (hasNewMedia || hasExistingMedia) {
    const imageUrl = resolveProfileImage(
      req.files,
      entityName,
      req.body.existingImage ?? user.image,
    );
    if (imageUrl !== undefined) updates.image = imageUrl;

    const kyc = mergeKycDocuments(
      req.files,
      entityName,
      req.body.existingKycDocuments,
    );
    if (kyc !== undefined) updates.kycDocuments = kyc;
  } else {
    if (image !== undefined) {
      updates.image = image?.trim() ?? "";
    }
    if (kycDocuments !== undefined) {
      updates.kycDocuments = normalizeMediaList(kycDocuments);
    }
  }

  if (password !== undefined) {
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password cannot be empty",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }
    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is required to set a new password",
      });
    }
    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
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
      message: "Profile updated successfully",
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

module.exports = { getProfile, updateProfile };
