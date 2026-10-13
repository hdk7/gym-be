"use strict";

const uploadService = require("./upload.service");
const { success } = require("../../shared/response");

/**
 * POST /api/v1/uploads/photo
 * Uploads a profile photo to Cloudinary.
 * Expects multipart/form-data with field name "photo".
 * Returns: { url, publicId, format, width, height, bytes }
 */
async function uploadPhoto(req, res, next) {
  try {
    const result = await uploadService.uploadPhoto(req.file);
    return success(res, result, "Photo uploaded successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/uploads/document
 * Uploads a medical document (PDF or image) to Cloudinary.
 * Expects multipart/form-data with field name "document".
 * Returns: { url, publicId, format, bytes, resourceType }
 */
async function uploadDocument(req, res, next) {
  try {
    const result = await uploadService.uploadDocument(req.file);
    return success(res, result, "Document uploaded successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/uploads/video
 * Uploads a video to Cloudinary.
 * Expects multipart/form-data with field name "video".
 * Returns: { url, thumbnailUrl, publicId, duration, format, bytes, resourceType }
 */
async function uploadVideo(req, res, next) {
  try {
    const result = await uploadService.uploadVideo(req.file);
    return success(res, result, "Video uploaded successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/uploads/portfolio-media
 * Uploads either a photo or video for the portfolio module.
 * Expects multipart/form-data with field name "media" or "file".
 * Returns: { url, thumbnailUrl, publicId, format, width, height, bytes, resourceType }
 */
async function uploadPortfolioMedia(req, res, next) {
  try {
    const file = req.file;
    const result = await uploadService.uploadPortfolioMedia(file);
    return success(res, result, "Portfolio media uploaded successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/uploads/:publicId
 * Deletes an asset from Cloudinary.
 * Query param: ?type=image|video|raw  (default: image)
 */
async function deleteAsset(req, res, next) {
  try {
    // publicId may contain slashes (e.g. "strengthway/photos/abc123")
    // Express 5 wildcard /*path provides req.params.path
    const publicId = decodeURIComponent(req.params.path || req.params[0] || req.params.publicId || "");
    const resourceType = req.query.type || "image";
    const result = await uploadService.deleteAsset(publicId, resourceType);
    return success(res, result, "Asset deleted successfully.");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadPhoto,
  uploadDocument,
  uploadVideo,
  uploadPortfolioMedia,
  deleteAsset,
};

