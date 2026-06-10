const multer = require("multer");
const {
  resolveUploadDir,
  uniqueFilename,
} = require("../utils/mediaStorage");
const { MAX_FILE_SIZE, fileFilter } = require("./uploadCommon");
const { FIELD_TO_SUBTYPE } = require("../utils/propertyMedia");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const title = req.body.title?.trim();
      if (!title) {
        return cb(new Error("Property title is required for media upload"));
      }

      const subType = FIELD_TO_SUBTYPE[file.fieldname];
      if (!subType) {
        return cb(new Error(`Invalid upload field: ${file.fieldname}`));
      }

      const { dir } = resolveUploadDir({
        category: "property",
        entityName: title,
        subType,
      });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, uniqueFilename(file.originalname));
  },
});

const propertyUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const propertyMediaFields = propertyUpload.fields([
  { name: "images", maxCount: 20 },
  { name: "titleDeed", maxCount: 10 },
  { name: "propertyTaxReceipts", maxCount: 10 },
  { name: "occupancyCertificate", maxCount: 10 },
  { name: "floorPlan", maxCount: 10 },
]);

module.exports = { propertyMediaFields };
