const path = require("path");
const { buildPublicMediaUrl, resolveUploadDir } = require("./mediaStorage");

const FIELD_TO_SUBTYPE = {
  images: "images",
  flyers: "flyer",
  titleDeed: "legaldocument/title-deed",
  propertyTaxReceipts: "legaldocument/property-tax-receipts",
  occupancyCertificate: "legaldocument/occupancy-certificate",
  floorPlan: "legaldocument/floor-plan",
};

const LEGAL_DOCUMENT_FILE_FIELDS = [
  "titleDeed",
  "propertyTaxReceipts",
  "occupancyCertificate",
  "floorPlan",
];

const EMPTY_LEGAL_DOCUMENTS = {
  titleDeed: [],
  propertyTaxReceipts: [],
  occupancyCertificate: [],
  floorPlan: [],
  approvalsInPlace: [],
};

function normalizeUrlList(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function parseJsonMediaField(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObjectField(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeLegalDocuments(value) {
  if (!value) return { ...EMPTY_LEGAL_DOCUMENTS };

  if (Array.isArray(value)) {
    return {
      ...EMPTY_LEGAL_DOCUMENTS,
      titleDeed: normalizeUrlList(value),
    };
  }

  const parsed = parseJsonObjectField(value) ?? value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...EMPTY_LEGAL_DOCUMENTS };
  }

  return {
    titleDeed: normalizeUrlList(parsed.titleDeed),
    propertyTaxReceipts: normalizeUrlList(parsed.propertyTaxReceipts),
    occupancyCertificate: normalizeUrlList(parsed.occupancyCertificate),
    floorPlan: normalizeUrlList(parsed.floorPlan),
    approvalsInPlace: normalizeUrlList(parsed.approvalsInPlace),
  };
}

function parseApprovalsInPlace(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return normalizeUrlList(value);
  const parsed = parseJsonObjectField(value);
  if (Array.isArray(parsed)) return normalizeUrlList(parsed);
  if (typeof value === "string") {
    try {
      const jsonParsed = JSON.parse(value);
      return normalizeUrlList(jsonParsed);
    } catch {
      return normalizeUrlList([value]);
    }
  }
  return [];
}

function collectUploadedUrls(files, fieldName, title) {
  const uploaded = files?.[fieldName];
  if (!uploaded?.length) return [];

  const subType = FIELD_TO_SUBTYPE[fieldName];
  const { relativePath } = resolveUploadDir({
    category: "property",
    entityName: title,
    subType,
  });

  return uploaded.map((file) =>
    buildPublicMediaUrl(path.posix.join(relativePath, file.filename)),
  );
}

function mergePropertyMedia(files, fieldName, title, existingField) {
  const existing = parseJsonMediaField(existingField)
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  const uploaded = collectUploadedUrls(files, fieldName, title);
  return [...existing, ...uploaded];
}

function buildLegalDocuments(files, title, existingField, approvalsInPlace) {
  const existing = normalizeLegalDocuments(existingField);
  const result = { ...existing };

  for (const field of LEGAL_DOCUMENT_FILE_FIELDS) {
    result[field] = [
      ...existing[field],
      ...collectUploadedUrls(files, field, title),
    ];
  }

  if (approvalsInPlace !== undefined) {
    result.approvalsInPlace = parseApprovalsInPlace(approvalsInPlace);
  }

  return result;
}

function hasLegalDocumentUploads(files) {
  if (!files) return false;
  return LEGAL_DOCUMENT_FILE_FIELDS.some((field) => files[field]?.length);
}

module.exports = {
  FIELD_TO_SUBTYPE,
  LEGAL_DOCUMENT_FILE_FIELDS,
  EMPTY_LEGAL_DOCUMENTS,
  parseJsonMediaField,
  normalizeLegalDocuments,
  parseApprovalsInPlace,
  collectUploadedUrls,
  mergePropertyMedia,
  buildLegalDocuments,
  hasLegalDocumentUploads,
};
