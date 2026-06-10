const Property = require("../models/Property");
const { canModifyProperty } = require("../middleware/requirePropertyManager");
const { isValidObjectId } = require("../utils/validateId");

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

const activePropertyFilter = { isDeleted: { $ne: true } };

const getAll = async (req, res) => {
  const properties = await Property.find(activePropertyFilter)
    .sort({ createdAt: -1 })
    .populate("sellerId", "name email role")
    .lean();

  res.json({ success: true, data: properties });
};

const getById = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid property id" });
  }

  const property = await Property.findOne({ _id: id, ...activePropertyFilter })
    .populate("sellerId", "name email role")
    .lean();

  if (!property) {
    return res
      .status(404)
      .json({ success: false, message: "Property not found" });
  }

  res.json({ success: true, data: property });
};

const create = async (req, res) => {
  const {
    title,
    description,
    images,
    address,
    city,
    state,
    pincode,
    category,
    buildingType,
    area,
    pricePerSqft,
    status,
  } = req.body;

  const trimmedTitle = title?.trim();
  const trimmedCategory = category?.trim();

  if (!trimmedTitle) {
    return res.status(400).json({
      success: false,
      message: "Title is required",
    });
  }

  if (!trimmedCategory) {
    return res.status(400).json({
      success: false,
      message: "Category is required",
    });
  }

  const property = await Property.create({
    title: trimmedTitle,
    description: description?.trim() ?? "",
    images: normalizeImages(images),
    address: address?.trim() ?? "",
    city: city?.trim() ?? "",
    state: state?.trim() ?? "",
    pincode: pincode?.trim() ?? "",
    category: trimmedCategory,
    buildingType: buildingType?.trim() ?? "",
    area: area?.trim() ?? "",
    pricePerSqft: pricePerSqft?.trim() ?? "",
    status: status?.trim() ?? "",
    sellerId: req.user._id,
  });

  const created = await Property.findById(property._id)
    .populate("sellerId", "name email role")
    .lean();

  res.status(201).json({
    success: true,
    message: "Property created successfully",
    data: created,
  });
};

const update = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid property id" });
  }

  const property = await Property.findOne({ _id: id, ...activePropertyFilter });
  if (!property) {
    return res
      .status(404)
      .json({ success: false, message: "Property not found" });
  }

  if (!canModifyProperty(req.user, property)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to update this property",
    });
  }

  const updates = {};
  const {
    title,
    description,
    images,
    address,
    city,
    state,
    pincode,
    category,
    buildingType,
    area,
    pricePerSqft,
    status,
  } = req.body;

  if (title !== undefined) {
    const trimmed = title?.trim();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Title cannot be empty",
      });
    }
    updates.title = trimmed;
  }

  if (description !== undefined)
    updates.description = description?.trim() ?? "";
  if (images !== undefined) updates.images = normalizeImages(images);
  if (address !== undefined) updates.address = address?.trim() ?? "";
  if (city !== undefined) updates.city = city?.trim() ?? "";
  if (state !== undefined) updates.state = state?.trim() ?? "";
  if (pincode !== undefined) updates.pincode = pincode?.trim() ?? "";
  if (buildingType !== undefined)
    updates.buildingType = buildingType?.trim() ?? "";
  if (area !== undefined) updates.area = area?.trim() ?? "";
  if (pricePerSqft !== undefined)
    updates.pricePerSqft = pricePerSqft?.trim() ?? "";

  if (category !== undefined) {
    const trimmed = category?.trim();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be empty",
      });
    }
    updates.category = trimmed;
  }

  if (status !== undefined) updates.status = status?.trim() ?? "";

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided to update",
    });
  }

  const updated = await Property.findByIdAndUpdate(property._id, updates, {
    new: true,
    runValidators: true,
  })
    .populate("sellerId", "name email role")
    .lean();

  res.json({
    success: true,
    message: "Property updated successfully",
    data: updated,
  });
};

const remove = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid property id" });
  }

  const property = await Property.findOne({ _id: id, ...activePropertyFilter });
  if (!property) {
    return res
      .status(404)
      .json({ success: false, message: "Property not found" });
  }

  if (!canModifyProperty(req.user, property)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to delete this property",
    });
  }

  await Property.findByIdAndUpdate(property._id, {
    isDeleted: true,
    deletedAt: new Date(),
  });

  res.json({
    success: true,
    message: "Property deleted successfully",
  });
};

module.exports = { getAll, getById, create, update, remove };
