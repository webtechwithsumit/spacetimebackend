const Property = require("../models/Property");
const {
  buildLiveAuctionsFilter,
  buildPropertyListFilter,
  canAccessPropertyList,
  canModifyProperty,
  canViewProperty,
} = require("../middleware/requirePropertyManager");
const {
  buildLegalDocuments,
  hasLegalDocumentUploads,
  mergePropertyMedia,
  normalizeLegalDocuments,
} = require("../utils/propertyMedia");
const {
  pickStringFields,
  parseStringArrayField,
  STRING_PROPERTY_FIELDS,
  trimString,
} = require("../utils/propertyFields");
const { isValidObjectId } = require("../utils/validateId");

function normalizeMediaList(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

const activePropertyFilter = { isDeleted: { $ne: true } };

const getAll = async (req, res) => {
  if (!canAccessPropertyList(req.user)) {
    return res.status(403).json({
      success: false,
      message: "Use live auctions to browse properties as a buyer",
    });
  }

  const filter = buildPropertyListFilter(req.user);

  const properties = await Property.find(filter)
    .sort({ createdAt: -1 })
    .populate("sellerId", "name email role")
    .lean();

  res.json({ success: true, data: properties });
};

const getLiveAuctions = async (req, res) => {
  const properties = await Property.find(buildLiveAuctionsFilter())
    .sort({ auctionEndDateTime: 1, createdAt: -1 })
    .select(
      "title description images category city state address microMarketLocality buildingName startingBidAmount bidIncrement auctionStartDateTime auctionEndDateTime ribbonText amenities status auctionStatus totalPrice pricePerSqft",
    )
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

  if (!canViewProperty(req.user, property)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view this property",
    });
  }

  res.json({ success: true, data: property });
};

const create = async (req, res) => {
  const trimmedTitle = trimString(req.body.title);
  const trimmedCategory = trimString(req.body.category);

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

  const parkingTypes = parseStringArrayField(req.body.parkingTypes) ?? [];

  const property = await Property.create({
    ...pickStringFields(req.body, [
      "description",
      "address",
      "city",
      "state",
      "pincode",
      "plotNumber",
      "microMarketLocality",
      "buildingName",
      "roadName",
      "buildingType",
      "area",
      "plotArea",
      "plotAreaUnit",
      "totalCarpetArea",
      "superArea",
      "totalFloorsInBuilding",
      "floorsOffered",
      "totalCarParks",
      "carParkingIncluded",
      "constructionStatus",
      "ageOfProperty",
      "furnishingStatus",
      "furnishingOther",
      "totalPrice",
      "pricePerSqft",
      "propertyTax",
      "estimatedMonthlyMaintenance",
      "occupancyStatus",
    ]),
    title: trimmedTitle,
    category: trimmedCategory,
    status: trimString(req.body.status) || "Draft",
    parkingTypes,
    images: mergePropertyMedia(req.files, "images", trimmedTitle),
    legalDocuments: buildLegalDocuments(
      req.files,
      trimmedTitle,
      null,
      req.body.approvalsInPlace,
    ),
    flyers: [],
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

  const updates = pickStringFields(req.body, STRING_PROPERTY_FIELDS);

  if (req.body.title !== undefined) {
    const trimmed = trimString(req.body.title);
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Title cannot be empty",
      });
    }
    updates.title = trimmed;
  }

  if (req.body.category !== undefined) {
    const trimmed = trimString(req.body.category);
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be empty",
      });
    }
    updates.category = trimmed;
  }

  if (req.body.parkingTypes !== undefined) {
    updates.parkingTypes = parseStringArrayField(req.body.parkingTypes) ?? [];
  }

  if (req.body.tags !== undefined) {
    updates.tags = parseStringArrayField(req.body.tags) ?? [];
  }

  const mediaTitle = updates.title ?? property.title;
  const hasNewMedia =
    req.files &&
    (req.files.images?.length || hasLegalDocumentUploads(req.files));
  const hasExistingMedia =
    req.body.existingImages !== undefined ||
    req.body.existingLegalDocuments !== undefined;
  const hasLegalMeta =
    req.body.approvalsInPlace !== undefined ||
    req.body.existingLegalDocuments !== undefined;

  if (hasNewMedia || hasExistingMedia || hasLegalMeta) {
    if (hasNewMedia || req.body.existingImages !== undefined) {
      updates.images = mergePropertyMedia(
        req.files,
        "images",
        mediaTitle,
        req.body.existingImages,
      );
    }
    if (hasNewMedia || hasExistingMedia || hasLegalMeta) {
      updates.legalDocuments = buildLegalDocuments(
        req.files,
        mediaTitle,
        req.body.existingLegalDocuments ?? property.legalDocuments,
        req.body.approvalsInPlace,
      );
    }
  } else {
    if (req.body.images !== undefined) {
      updates.images = normalizeMediaList(req.body.images);
    }
    if (req.body.legalDocuments !== undefined) {
      updates.legalDocuments = normalizeLegalDocuments(req.body.legalDocuments);
    }
    if (req.body.flyers !== undefined) {
      updates.flyers = normalizeMediaList(req.body.flyers);
    }
  }

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

module.exports = {
  getAll,
  getLiveAuctions,
  getById,
  create,
  update,
  remove,
};
