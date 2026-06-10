const multer = require("multer");
const {
  resolveUploadDir,
  uniqueFilename,
} = require("../utils/mediaStorage");
const { MAX_FILE_SIZE, fileFilter } = require("./uploadCommon");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const name = req.body.name?.trim();
      if (!name) {
        return cb(new Error("Name is required for profile media upload"));
      }

      const category = file.fieldname === "image" ? "profile" : "kyc";
      const { dir } = resolveUploadDir({
        category,
        entityName: name,
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

const profileUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const profileMediaFields = profileUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "kycDocuments", maxCount: 20 },
]);

module.exports = { profileMediaFields };
