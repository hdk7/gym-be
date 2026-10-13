"use strict";

const router = require("express").Router();
const multer = require("multer");
const ctrl = require("./upload.controller");
const { authenticate } = require("../../middleware/auth.middleware");
const { BadRequestError } = require("../../shared/apiError");

// ── Multer: memory storage (no temp files on disk) ───────────────────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ALLOWED = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];
  if (ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const videoFilter = (req, file, cb) => {
  const ALLOWED = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
  ];
  if (ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`Unsupported video type: ${file.mimetype}. Allowed: MP4, WebM, MOV.`), false);
  }
};

const mediaFilter = (req, file, cb) => {
  const ALLOWED = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
  ];
  if (ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`Unsupported media type: ${file.mimetype}. Allowed: Images and Videos.`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB hard limit
  fileFilter,
});

const uploadVideoMulter = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
  fileFilter: videoFilter,
});

const uploadMediaMulter = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
  fileFilter: mediaFilter,
});

// ── Multer error handler helper ───────────────────────────────────────────────
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new BadRequestError("File too large. Maximum allowed size exceeded."));
    }
    return next(new BadRequestError("File upload error: " + err.message));
  }
  next(err);
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/v1/uploads/photo
// Accepts field name "photo" (single file)
router.post(
  "/photo",
  authenticate,
  upload.single("photo"),
  handleMulterError,
  ctrl.uploadPhoto
);

// POST /api/v1/uploads/document
// Accepts field name "document" (single file)
router.post(
  "/document",
  authenticate,
  upload.single("document"),
  handleMulterError,
  ctrl.uploadDocument
);

// POST /api/v1/uploads/video
// Accepts field name "video" (single file)
router.post(
  "/video",
  authenticate,
  uploadVideoMulter.single("video"),
  handleMulterError,
  ctrl.uploadVideo
);

// POST /api/v1/uploads/portfolio-media
// Accepts field name "media" or "file" (single file)
router.post(
  "/portfolio-media",
  authenticate,
  (req, res, next) => {
    // Support either 'media' or 'file' field name
    uploadMediaMulter.fields([
      { name: "media", maxCount: 1 },
      { name: "file", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      if (req.files) {
        req.file = req.files.media?.[0] || req.files.file?.[0] || null;
      }
      next();
    });
  },
  ctrl.uploadPortfolioMedia
);

// DELETE /api/v1/uploads/*path
// publicId is passed as wildcard path (handles nested folder paths)
// Example: DELETE /api/v1/uploads/strengthway%2Fphotos%2Fabc123?type=image
router.delete("/*path", authenticate, ctrl.deleteAsset);

module.exports = router;
