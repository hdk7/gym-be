"use strict";

const cloudinary = require("cloudinary").v2;
const { Readable } = require("stream");
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = require("../../config/env");
const { BadRequestError, InternalError } = require("../../shared/apiError");

// ── Configure Cloudinary ─────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// ── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PORTFOLIO_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

const isCloudinaryConfigured =
  Boolean(CLOUDINARY_CLOUD_NAME) &&
  CLOUDINARY_CLOUD_NAME !== "your_cloud_name" &&
  Boolean(CLOUDINARY_API_KEY) &&
  CLOUDINARY_API_KEY !== "your_api_key";

/**
 * Upload a buffer to Cloudinary using upload_stream.
 * Returns the upload result (secure_url, public_id, etc.)
 */
function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
  });
}

class UploadService {
  /**
   * Upload a profile photo.
   * Resizes to max 800×800, converts to WebP.
   */
  async uploadPhoto(file) {
    if (!file) {
      throw new BadRequestError("No file provided.");
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestError(
        `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.map((t) => t.split("/")[1].toUpperCase()).join(", ")}.`
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestError("File too large. Maximum allowed size is 5 MB.");
    }

    if (!isCloudinaryConfigured) {
      const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      return {
        url: dataUrl,
        publicId: `dev-photo-${Date.now()}`,
        format: file.mimetype.split("/")[1] || "webp",
        width: 800,
        height: 800,
        bytes: file.size,
      };
    }

    try {
      const result = await uploadToCloudinary(file.buffer, {
        folder: "strengthway/photos",
        resource_type: "image",
        transformation: [
          { width: 800, height: 800, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      };
    } catch (err) {
      throw new InternalError("Photo upload failed: " + err.message);
    }
  }

  /**
   * Upload a medical document (PDF or image).
   */
  async uploadDocument(file) {
    if (!file) {
      throw new BadRequestError("No file provided.");
    }

    if (!ALLOWED_DOC_TYPES.includes(file.mimetype)) {
      throw new BadRequestError(
        "Invalid file type. Allowed types: PDF, JPEG, PNG, WEBP."
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestError("File too large. Maximum allowed size is 5 MB.");
    }

    if (!isCloudinaryConfigured) {
      const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      return {
        url: dataUrl,
        publicId: `dev-doc-${Date.now()}`,
        format: file.mimetype.split("/")[1] || "pdf",
        bytes: file.size,
        resourceType: file.mimetype.includes("pdf") ? "raw" : "image",
      };
    }

    try {
      const result = await uploadToCloudinary(file.buffer, {
        folder: "strengthway/documents",
        resource_type: "auto", // allows PDF
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        resourceType: result.resource_type,
      };
    } catch (err) {
      throw new InternalError("Document upload failed: " + err.message);
    }
  }

  /**
   * Upload a video (MP4, WebM, MOV) to Cloudinary.
   * Extracts poster frame thumbnail URL automatically.
   */
  async uploadVideo(file) {
    if (!file) {
      throw new BadRequestError("No video file provided.");
    }

    if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      throw new BadRequestError(
        `Invalid video type. Allowed types: MP4, WebM, QuickTime (MOV). Received: ${file.mimetype}`
      );
    }

    if (file.size > MAX_VIDEO_SIZE) {
      throw new BadRequestError("Video file too large. Maximum allowed size is 50 MB.");
    }

    if (!isCloudinaryConfigured) {
      const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      return {
        url: dataUrl,
        thumbnailUrl: "",
        publicId: `dev-vid-${Date.now()}`,
        duration: null,
        format: file.mimetype.split("/")[1] || "mp4",
        bytes: file.size,
        resourceType: "video",
      };
    }

    try {
      const result = await uploadToCloudinary(file.buffer, {
        folder: "strengthway/portfolio/videos",
        resource_type: "video",
      });

      // Extract poster thumbnail frame
      const thumbnailUrl = result.secure_url
        ? result.secure_url.replace(/\.[^/.]+$/, ".jpg")
        : "";

      return {
        url: result.secure_url,
        thumbnailUrl,
        publicId: result.public_id,
        duration: result.duration || null,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        resourceType: "video",
      };
    } catch (err) {
      throw new InternalError("Video upload failed: " + err.message);
    }
  }

  /**
   * Upload portfolio media (either a high-res photo or video).
   * Automatically inspects MIME type and routes appropriately.
   */
  async uploadPortfolioMedia(file) {
    if (!file) {
      throw new BadRequestError("No media file provided.");
    }

    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      return this.uploadVideo(file);
    }

    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      if (file.size > MAX_PORTFOLIO_IMAGE_SIZE) {
        throw new BadRequestError("Image file too large. Maximum allowed size is 10 MB.");
      }

      if (!isCloudinaryConfigured) {
        const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        return {
          url: dataUrl,
          thumbnailUrl: dataUrl,
          publicId: `dev-photo-${Date.now()}`,
          format: file.mimetype.split("/")[1] || "webp",
          width: 1200,
          height: 1500,
          bytes: file.size,
          resourceType: "image",
        };
      }

      try {
        const result = await uploadToCloudinary(file.buffer, {
          folder: "strengthway/portfolio/photos",
          resource_type: "image",
          transformation: [
            { width: 1600, height: 2000, crop: "limit" },
            { quality: "auto", fetch_format: "auto" },
          ],
        });

        return {
          url: result.secure_url,
          thumbnailUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          resourceType: "image",
        };
      } catch (err) {
        throw new InternalError("Portfolio photo upload failed: " + err.message);
      }
    }

    throw new BadRequestError(
      `Unsupported media type: ${file.mimetype}. Allowed: Images (JPEG, PNG, WEBP, GIF) and Videos (MP4, WebM, QuickTime).`
    );
  }

  /**
   * Delete an asset from Cloudinary by its public_id.
   */
  async deleteAsset(publicId, resourceType) {
    if (!publicId) {
      return { publicId: null, result: "skipped" };
    }

    if (publicId.startsWith("dev-") || !isCloudinaryConfigured) {
      return { publicId, result: "ok" };
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType || "image",
      });
      return { publicId, result: result.result };
    } catch (err) {
      console.error(`[UploadService] Warning: Failed to destroy Cloudinary asset "${publicId}":`, err.message);
      return { publicId, error: err.message };
    }
  }
}

module.exports = new UploadService();

