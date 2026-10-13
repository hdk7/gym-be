"use strict";

const portfolioRepository = require("./portfolio.repository");
const uploadService = require("../uploads/upload.service");
const { NotFoundError, BadRequestError } = require("../../shared/apiError");
const { PORTFOLIO_SECTION, PORTFOLIO_STATUS } = require("../../shared/constants");
const { generatePortfolioId } = require("../../shared/idGenerator");

class PortfolioService {
  /**
   * Get all active portfolio items grouped by section for the public site.
   */
  async getPublicGrouped() {
    return portfolioRepository.findActiveGrouped();
  }

  /**
   * Get filtered and paginated portfolio items for admin masters view.
   */
  async getAll({ section, status, search, skip = 0, limit = 100 } = {}) {
    const filter = { isDeleted: false };

    if (section && section !== "ALL") {
      if (section === "TRAINING_SESSION") {
        filter.$or = [{ section: "TRAINING_SESSION" }, { category: "SESSION_DISCIPLINE" }];
      } else if (section === "SESSION_CLIP") {
        filter.$or = [{ section: "SESSION_CLIP" }, { category: "SESSION_CLIP" }];
      } else if (section === "FEEDBACK_QUOTE") {
        filter.$or = [
          { section: "FEEDBACK_QUOTE" },
          { category: { $in: ["FEEDBACK_STORY", "MEMBER_FEEDBACK"] }, mediaType: { $ne: "VIDEO" } },
        ];
      } else if (section === "FEEDBACK_VIDEO") {
        filter.$or = [
          { section: "FEEDBACK_VIDEO" },
          { category: "FEEDBACK_STORY", mediaType: "VIDEO" },
        ];
      } else if (section === "PHOTO") {
        filter.$or = [{ section: "PHOTO" }, { category: { $in: ["PHOTO", "FLOOR_PHOTO"] } }];
      } else if (section === "VIDEO") {
        filter.$or = [{ section: "VIDEO" }, { category: { $in: ["VIDEO", "MOVEMENT_VIDEO"] } }];
      } else {
        filter.$or = [{ section }, { category: section }];
      }
    }

    if (status && status !== "ALL") {
      filter.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const searchConds = [
        { title: { $regex: q, $options: "i" } },
        { subtitle: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { authorName: { $regex: q, $options: "i" } },
        { authorRole: { $regex: q, $options: "i" } },
        { quote: { $regex: q, $options: "i" } },
        { tag: { $regex: q, $options: "i" } },
        { id: { $regex: q, $options: "i" } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConds }];
        delete filter.$or;
      } else {
        filter.$or = searchConds;
      }
    }

    return portfolioRepository.findAll({
      filter,
      skip,
      limit,
      sort: { order: 1, displayOrder: 1, createdAt: -1 },
    });
  }

  /**
   * Get single item by ID.
   */
  async getById(id) {
    if (!id) throw new BadRequestError("Item ID is required.");
    const item = await portfolioRepository.findById(id);
    if (!item || item.isDeleted) {
      throw new NotFoundError(`Portfolio item "${id}" not found.`);
    }
    return item;
  }

  /**
   * Create a new portfolio item.
   */
  async create(body = {}) {
    const title = (body.title || body.authorName || body.altText || "").trim();
    if (!title) {
      throw new BadRequestError("Title is required.");
    }

    let section = body.section;
    if (!section && body.category) {
      section = body.category;
    }
    if (!section) {
      section = PORTFOLIO_SECTION.TRAINING_SESSION;
    }

    const maxSuffix = await portfolioRepository.getMaxIdSuffix();
    const id = body.id || generatePortfolioId(maxSuffix);

    // Calculate sequential order if not explicitly set
    let order = Number(body.order);
    if (isNaN(order) || order === 0) {
      const count = await portfolioRepository.countTotal({
        section,
        isDeleted: false,
      });
      order = count + 1;
    }

    const payload = {
      id,
      section,
      category: body.category || section,
      title,
      subtitle: body.subtitle ? body.subtitle.trim() : (body.authorRole || body.description || ""),
      description: body.description || body.subtitle || "",
      authorName: body.authorName || title,
      authorRole: body.authorRole || body.subtitle || "",
      quote: body.quote || body.tag || "",
      mediaUrl: body.mediaUrl || "",
      mediaType: body.mediaType || (section.includes("VIDEO") || section.includes("CLIP") ? "VIDEO" : "IMAGE"),
      publicId: body.publicId || "",
      thumbnailUrl: body.thumbnailUrl || "",
      duration: body.duration ? body.duration.trim() : (body.durationText || ""),
      durationText: body.durationText || body.duration || "",
      level: body.level || "All levels",
      icon: body.icon || body.iconKey || "Dumbbell",
      iconKey: body.iconKey || body.icon || "Dumbbell",
      rating: body.rating ? Math.min(5, Math.max(1, Number(body.rating))) : 5,
      focusPosition: body.focusPosition || "object-top",
      tag: body.tag ? body.tag.trim() : (body.quote || ""),
      altText: body.altText || title,
      order,
      displayOrder: order,
      status: body.status || PORTFOLIO_STATUS.ACTIVE,
      isDeleted: false,
    };

    return portfolioRepository.create(payload);
  }

  /**
   * Update an existing portfolio item.
   */
  async update(id, body = {}) {
    const existing = await this.getById(id);

    const updates = {};
    if (body.title !== undefined) {
      updates.title = body.title.trim();
      updates.authorName = body.title.trim();
      updates.altText = body.title.trim();
    }
    if (body.subtitle !== undefined) {
      updates.subtitle = body.subtitle.trim();
      updates.authorRole = body.subtitle.trim();
      updates.description = body.subtitle.trim();
    }
    if (body.section !== undefined) {
      updates.section = body.section;
      updates.category = body.section;
    }
    if (body.category !== undefined) {
      updates.category = body.category;
    }
    if (body.authorName !== undefined) updates.authorName = body.authorName.trim();
    if (body.authorRole !== undefined) updates.authorRole = body.authorRole.trim();
    if (body.quote !== undefined) {
      updates.quote = body.quote.trim();
      updates.tag = body.quote.trim();
    }
    if (body.tag !== undefined) updates.tag = body.tag.trim();
    if (body.duration !== undefined) {
      updates.duration = body.duration.trim();
      updates.durationText = body.duration.trim();
    }
    if (body.level !== undefined) updates.level = body.level;
    if (body.icon !== undefined) {
      updates.icon = body.icon;
      updates.iconKey = body.icon;
    }
    if (body.rating !== undefined) updates.rating = Math.min(5, Math.max(1, Number(body.rating)));
    if (body.focusPosition !== undefined) updates.focusPosition = body.focusPosition;
    if (body.order !== undefined) {
      updates.order = Number(body.order);
      updates.displayOrder = Number(body.order);
    }
    if (body.status !== undefined) updates.status = body.status;

    // Handle media updates: If media was replaced and old publicId exists, clean up old asset
    if (body.mediaUrl !== undefined) {
      if (existing.publicId && body.publicId && existing.publicId !== body.publicId) {
        const isVideo = existing.section.includes("VIDEO") || existing.section.includes("CLIP");
        await uploadService.deleteAsset(existing.publicId, isVideo ? "video" : "image").catch(() => null);
      }
      updates.mediaUrl = body.mediaUrl;
    }
    if (body.publicId !== undefined) updates.publicId = body.publicId;
    if (body.thumbnailUrl !== undefined) updates.thumbnailUrl = body.thumbnailUrl;

    return portfolioRepository.updateById(id, updates);
  }

  /**
   * Quick toggle between Active and Inactive.
   */
  async toggleStatus(id) {
    const existing = await this.getById(id);
    const newStatus =
      existing.status === PORTFOLIO_STATUS.ACTIVE
        ? PORTFOLIO_STATUS.INACTIVE
        : PORTFOLIO_STATUS.ACTIVE;

    return portfolioRepository.updateById(id, { status: newStatus });
  }

  /**
   * Bulk reorder items.
   */
  async reorder(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError("Items array is required for reordering.");
    }
    await portfolioRepository.bulkUpdateOrder(items);
    return { success: true, count: items.length };
  }

  /**
   * Delete an item (soft-delete by default, or permanent with Cloudinary asset cleanup).
   */
  async delete(id, { permanent = false } = {}) {
    const existing = await this.getById(id);

    if (permanent) {
      if (existing.publicId) {
        const isVideo = existing.section.includes("VIDEO") || existing.section.includes("CLIP");
        await uploadService.deleteAsset(existing.publicId, isVideo ? "video" : "image").catch(() => null);
      }
      return portfolioRepository.deletePermanentlyById(id);
    }

    return portfolioRepository.softDeleteById(id);
  }

  /**
   * Seed initial data into the database if empty.
   */
  async seedInitialData() {
    const currentCount = await portfolioRepository.countTotal({});
    if (currentCount > 0) {
      return { seeded: 0, message: "Portfolio already contains items." };
    }
    return { seeded: 0, message: "No initial seeding needed." };
  }
}

module.exports = new PortfolioService();
