const mongoose = require("mongoose");
const { isValidObjectId } = require("./validateId");

function resolvePropertyId(value) {
  if (!value || !isValidObjectId(String(value))) return undefined;
  return new mongoose.Types.ObjectId(String(value));
}

function resolveEventPropertyId(item) {
  return (
    resolvePropertyId(item?.propertyId) ||
    resolvePropertyId(item?.properties?.propertyId)
  );
}

function buildPropertyAnalyticsFilter(propertyId, range) {
  const objectId = new mongoose.Types.ObjectId(propertyId);
  const pathPrefix = `/auctions/${propertyId}`;

  return {
    createdAt: { $gte: range.from, $lte: range.to },
    $or: [
      { propertyId: objectId },
      { "properties.propertyId": propertyId },
      { path: pathPrefix },
      { path: { $regex: `^/auctions/${propertyId}(/|$)` } },
    ],
  };
}

function buildPropertyViewFilter(propertyId, range) {
  const objectId = new mongoose.Types.ObjectId(propertyId);
  return {
    createdAt: { $gte: range.from, $lte: range.to },
    event: "auction_viewed",
    $or: [
      { propertyId: objectId },
      { "properties.propertyId": propertyId },
    ],
  };
}

module.exports = {
  resolvePropertyId,
  resolveEventPropertyId,
  buildPropertyAnalyticsFilter,
  buildPropertyViewFilter,
};
