const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new Error(
        "Only image files (JPEG, PNG, WebP, GIF), PDF, and Word documents are allowed",
      ),
    );
  }
  cb(null, true);
}

module.exports = { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, fileFilter };
