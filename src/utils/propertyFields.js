const STRING_PROPERTY_FIELDS = [
  "title",
  "description",
  "address",
  "city",
  "state",
  "pincode",
  "plotNumber",
  "microMarketLocality",
  "buildingName",
  "roadName",
  "category",
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
  "status",
  "yearBuiltRenovated",
  "amenities",
  "reservePrice",
  "startingBidAmount",
  "bidIncrement",
  "auctionStartDateTime",
  "auctionEndDateTime",
  "ribbonText",
  "propertyVideoUrl",
  "matterportTourUrl",
  "auctionStatus",
  "exclusiveMandateSoldX",
  "canBrokerBid",
  "assignedAuctionAdvisorId",
];

const ADMIN_AUCTION_FIELDS = [
  "yearBuiltRenovated",
  "amenities",
  "reservePrice",
  "startingBidAmount",
  "bidIncrement",
  "auctionStartDateTime",
  "auctionEndDateTime",
  "ribbonText",
  "propertyVideoUrl",
  "matterportTourUrl",
  "auctionStatus",
  "exclusiveMandateSoldX",
  "canBrokerBid",
  "assignedAuctionAdvisorId",
];

const BASIC_STEP_FIELDS = [
  "title",
  "description",
  "category",
  "status",
  "address",
  "city",
  "state",
  "pincode",
  "plotNumber",
  "microMarketLocality",
  "buildingName",
  "roadName",
];

const PLOT_STEP_FIELDS = [
  "plotArea",
  "plotAreaUnit",
  "totalCarpetArea",
  "superArea",
  "totalFloorsInBuilding",
  "floorsOffered",
  "totalCarParks",
  "carParkingIncluded",
  "area",
  "buildingType",
];

const STATUS_STEP_FIELDS = [
  "constructionStatus",
  "ageOfProperty",
  "furnishingStatus",
  "furnishingOther",
];

const FINANCIAL_STEP_FIELDS = [
  "totalPrice",
  "pricePerSqft",
  "propertyTax",
  "estimatedMonthlyMaintenance",
];

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseStringArrayField(value) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => trimString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => trimString(item)).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function pickStringFields(body, fields) {
  const result = {};
  for (const field of fields) {
    if (body[field] !== undefined) {
      result[field] = trimString(body[field]);
    }
  }
  return result;
}

module.exports = {
  STRING_PROPERTY_FIELDS,
  BASIC_STEP_FIELDS,
  PLOT_STEP_FIELDS,
  STATUS_STEP_FIELDS,
  FINANCIAL_STEP_FIELDS,
  ADMIN_AUCTION_FIELDS,
  trimString,
  parseStringArrayField,
  pickStringFields,
};
