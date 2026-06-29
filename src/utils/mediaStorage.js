const fs = require("fs");
const path = require("path");
const { slugify } = require("./slugify");

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const MEDIA_CATEGORIES = ["profile", "property", "kyc", "blog"];

const PROPERTY_MEDIA_FOLDERS = [
  "images",
  "flyer",
  "legaldocument/title-deed",
  "legaldocument/property-tax-receipts",
  "legaldocument/occupancy-certificate",
  "legaldocument/floor-plan",
];

function getUploadRoot() {
  return UPLOAD_ROOT;
}

function initBaseMediaFolders() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  for (const category of MEDIA_CATEGORIES) {
    fs.mkdirSync(path.join(UPLOAD_ROOT, category), { recursive: true });
  }
}

function ensureEntityFolder(category, entityName) {
  const slug = slugify(entityName);
  const dir = path.join(UPLOAD_ROOT, category, slug);
  fs.mkdirSync(dir, { recursive: true });
  return { slug, dir };
}

function ensurePropertyFolders(propertyName) {
  const { slug, dir: propertyDir } = ensureEntityFolder("property", propertyName);
  for (const folder of PROPERTY_MEDIA_FOLDERS) {
    fs.mkdirSync(path.join(propertyDir, folder), { recursive: true });
  }
  return { slug, propertyDir };
}

function resolveUploadDir({ category, entityName, subType }) {
  if (!MEDIA_CATEGORIES.includes(category)) {
    throw new Error(`Invalid media category: ${category}`);
  }

  if (category === "blog") {
    if (!entityName?.trim()) {
      throw new Error("Title is required for blog media upload");
    }
    const { slug, dir } = ensureEntityFolder("blog", entityName);
    return {
      slug,
      dir,
      relativePath: `blog/${slug}`,
    };
  }

  if (category === "property") {
    if (!entityName?.trim()) {
      throw new Error("Property name is required for property media upload");
    }
    if (!subType || !PROPERTY_MEDIA_FOLDERS.includes(subType)) {
      throw new Error(
        `Property media folder must be one of: ${PROPERTY_MEDIA_FOLDERS.join(", ")}`,
      );
    }
    const { slug, propertyDir } = ensurePropertyFolders(entityName);
    return {
      slug,
      dir: path.join(propertyDir, subType),
      relativePath: `property/${slug}/${subType}`,
    };
  }

  if (!entityName?.trim()) {
    throw new Error("Entity name is required for media upload");
  }

  const { slug, dir } = ensureEntityFolder(category, entityName);
  return {
    slug,
    dir,
    relativePath: `${category}/${slug}`,
  };
}

function buildPublicMediaUrl(relativeFilePath) {
  const normalized = relativeFilePath.replace(/\\/g, "/");
  return `/uploads/${normalized}`;
}

function uniqueFilename(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  const base = path.basename(originalName || "file", ext).replace(/[^a-zA-Z0-9-_]/g, "");
  const stamp = Date.now();
  const random = Math.round(Math.random() * 1e6);
  return `${base || "file"}-${stamp}-${random}${ext}`;
}

module.exports = {
  MEDIA_CATEGORIES,
  PROPERTY_MEDIA_FOLDERS,
  getUploadRoot,
  initBaseMediaFolders,
  ensureEntityFolder,
  ensurePropertyFolders,
  resolveUploadDir,
  buildPublicMediaUrl,
  uniqueFilename,
};
