const path = require("path");
const { buildPublicMediaUrl, resolveUploadDir } = require("./mediaStorage");
const { parseJsonMediaField } = require("./propertyMedia");

function collectCategoryUrls(files, category, entityName) {
  if (!files?.length) return [];

  const { relativePath } = resolveUploadDir({
    category,
    entityName,
  });

  return files.map((file) =>
    buildPublicMediaUrl(path.posix.join(relativePath, file.filename)),
  );
}

function resolveProfileImage(files, entityName, existingImage) {
  if (files?.image?.length) {
    return collectCategoryUrls(files.image, "profile", entityName)[0];
  }

  if (existingImage !== undefined) {
    return typeof existingImage === "string" ? existingImage.trim() : "";
  }

  return undefined;
}

function mergeKycDocuments(files, entityName, existingField) {
  if (existingField === undefined && !files?.kycDocuments?.length) {
    return undefined;
  }

  const existing = parseJsonMediaField(existingField)
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  const uploaded = collectCategoryUrls(files?.kycDocuments, "kyc", entityName);
  return [...existing, ...uploaded];
}

module.exports = {
  resolveProfileImage,
  mergeKycDocuments,
};
