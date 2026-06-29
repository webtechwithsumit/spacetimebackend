const multer = require("multer");
const {
  resolveUploadDir,
  uniqueFilename,
  buildPublicMediaUrl,
} = require("../utils/mediaStorage");
const { MAX_FILE_SIZE, fileFilter } = require("./uploadCommon");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const title = req.body.title?.trim() || "blog-post";
      const { dir } = resolveUploadDir({
        category: "blog",
        entityName: title,
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

const blogUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed for blog media"));
    }
    fileFilter(req, file, cb);
  },
  limits: { fileSize: MAX_FILE_SIZE },
});

const blogMediaFields = blogUpload.fields([
  { name: "featuredImage", maxCount: 1 },
]);

function getUploadedFeaturedImage(req) {
  const file = req.files?.featuredImage?.[0];
  if (!file) return "";

  const title = req.body.title?.trim() || "blog-post";
  const { relativePath } = resolveUploadDir({
    category: "blog",
    entityName: title,
  });
  return buildPublicMediaUrl(`${relativePath}/${file.filename}`);
}

module.exports = { blogMediaFields, getUploadedFeaturedImage };
