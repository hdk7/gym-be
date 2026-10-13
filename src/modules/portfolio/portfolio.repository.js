 "use strict";

const PortfolioItem = require("./portfolio.model");

/**
 * Normalizes any portfolio document (whether stored in legacy or updated schema)
 * to have consistent section, category, title, subtitle, mediaUrl, order, etc.
 */
function normalizePortfolioDoc(doc) {
  if (!doc) return doc;

  const category = (doc.category || "").trim();
  let section = (doc.section || "").trim();

  // If section is not set, derive it from legacy category
  if (!section) {
    if (category === "SESSION_DISCIPLINE" || category === "TRAINING_SESSION") {
      section = "TRAINING_SESSION";
    } else if (category === "SESSION_CLIP") {
      section = "SESSION_CLIP";
    } else if (category === "FEEDBACK_STORY" || category === "MEMBER_FEEDBACK") {
      const isVideo =
        doc.mediaType === "VIDEO" ||
        (doc.mediaUrl && (doc.mediaUrl.endsWith(".mp4") || doc.mediaUrl.includes("video")));
      section = isVideo ? "FEEDBACK_VIDEO" : "FEEDBACK_QUOTE";
    } else if (category === "FEEDBACK_VIDEO") {
      section = "FEEDBACK_VIDEO";
    } else if (category === "PHOTO" || category === "FLOOR_PHOTO") {
      section = "PHOTO";
    } else if (category === "MOVEMENT_VIDEO" || category === "VIDEO") {
      section = "VIDEO";
    } else {
      section = "TRAINING_SESSION";
    }
  }

  const title = doc.title || doc.authorName || doc.altText || "";
  const subtitle = doc.subtitle || doc.authorRole || doc.description || "";
  const duration = doc.duration || doc.durationText || "50 min";
  const icon = doc.icon || doc.iconKey || "Dumbbell";
  const order = doc.order ?? doc.displayOrder ?? 0;
  const quote = doc.quote || doc.tag || "";
  const tag = doc.tag || quote || "";
  const authorName = doc.authorName || title || "";
  const authorRole = doc.authorRole || subtitle || "";
  const mediaUrl = doc.mediaUrl || "";

  return {
    ...doc,
    section,
    category: category || section,
    title,
    subtitle,
    duration,
    icon,
    order,
    displayOrder: order,
    quote,
    tag,
    authorName,
    authorRole,
    mediaUrl,
  };
}

class PortfolioRepository {
  /**
   * One-time auto-migration to persist section and mapped fields directly to MongoDB
   * for any documents that were created without section or order fields.
   */
  async migrateLegacyItems() {
    try {
      await PortfolioItem.updateMany(
        {
          thumbnailUrl: {
            $in: [
              "/assets/session-clip-1-thumb.jpg",
              "/assets/session-clip-2-thumb.jpg",
              "/assets/session-clip-3-thumb.jpg",
              "/assets/feedback-video-1-thumb.jpg",
              "/assets/feedback-video-2-thumb.jpg",
              "/assets/feedback-video-3-thumb.jpg",
            ],
          },
        },
        { $set: { thumbnailUrl: "" } }
      );

      const unmigrated = await PortfolioItem.find({
        $or: [
          { section: { $exists: false } },
          { section: null },
          { section: "" },
        ],
      }).lean();

      if (!unmigrated || unmigrated.length === 0) return 0;

      const bulkOps = unmigrated.map((item) => {
        const normalized = normalizePortfolioDoc(item);
        return {
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: {
                section: normalized.section,
                category: normalized.category,
                order: normalized.order,
                displayOrder: normalized.order,
                title: normalized.title,
                subtitle: normalized.subtitle,
                duration: normalized.duration,
                icon: normalized.icon,
                quote: normalized.quote,
                authorName: normalized.authorName,
                authorRole: normalized.authorRole,
                thumbnailUrl: normalized.thumbnailUrl,
                updatedAt: new Date(),
              },
            },
          },
        };
      });

      const result = await PortfolioItem.bulkWrite(bulkOps);
      return result.modifiedCount || 0;
    } catch (err) {
      console.warn("[PortfolioRepository] Legacy migration error (non-fatal):", err.message);
      return 0;
    }
  }

  /**
   * Find paginated and filtered items.
   */
  async findAll({ filter = {}, skip = 0, limit = 50, sort = { order: 1, createdAt: -1 } } = {}) {
    await this.migrateLegacyItems();

    const [rawDocs, total] = await Promise.all([
      PortfolioItem.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      PortfolioItem.countDocuments(filter),
    ]);

    const data = rawDocs.map(normalizePortfolioDoc);
    return { data, total };
  }

  /**
   * Find a single item by unique ID.
   */
  async findById(id) {
    const doc = await PortfolioItem.findOne({ id }).lean();
    return doc ? normalizePortfolioDoc(doc) : null;
  }

  /**
   * Create a new portfolio record.
   */
  async create(data) {
    const payload = {
      ...data,
      displayOrder: data.order ?? 0,
      category: data.category || data.section,
    };
    const item = new PortfolioItem(payload);
    const saved = (await item.save()).toObject();
    return normalizePortfolioDoc(saved);
  }

  /**
   * Update an existing item by ID.
   */
  async updateById(id, updates) {
    const updatePayload = { ...updates, updatedAt: new Date() };
    if (updates.order !== undefined) {
      updatePayload.displayOrder = updates.order;
    }
    if (updates.section !== undefined && !updates.category) {
      updatePayload.category = updates.section;
    }
    if (updates.title !== undefined && !updates.authorName) {
      updatePayload.authorName = updates.title;
    }
    if (updates.subtitle !== undefined && !updates.authorRole) {
      updatePayload.authorRole = updates.subtitle;
    }

    const updated = await PortfolioItem.findOneAndUpdate(
      { id },
      { $set: updatePayload },
      { returnDocument: "after", runValidators: false, lean: true }
    );
    return updated ? normalizePortfolioDoc(updated) : null;
  }

  /**
   * Soft-delete an item by setting isDeleted: true and status: Inactive.
   */
  async softDeleteById(id) {
    const updated = await PortfolioItem.findOneAndUpdate(
      { id },
      { $set: { isDeleted: true, status: "Inactive", deletedAt: new Date() } },
      { returnDocument: "after", lean: true }
    );
    return updated ? normalizePortfolioDoc(updated) : null;
  }

  /**
   * Permanently delete an item from the database.
   */
  async deletePermanentlyById(id) {
    return PortfolioItem.findOneAndDelete({ id }).lean();
  }

  /**
   * Bulk update order indexes for reordering items.
   * @param {Array<{ id: string, order: number }>} items
   */
  async bulkUpdateOrder(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      return { modifiedCount: 0 };
    }
    const bulkOps = items.map((it) => ({
      updateOne: {
        filter: { id: it.id },
        update: {
          $set: {
            order: Number(it.order),
            displayOrder: Number(it.order),
            updatedAt: new Date(),
          },
        },
      },
    }));
    return PortfolioItem.bulkWrite(bulkOps);
  }

  /**
   * Fetch all active items grouped by section for the public portfolio page.
   */
  async findActiveGrouped() {
    await this.migrateLegacyItems();

    const activeItemsRaw = await PortfolioItem.find({
      isDeleted: { $ne: true },
      status: "Active",
    })
      .sort({ order: 1, displayOrder: 1, createdAt: 1 })
      .lean();

    const activeItems = activeItemsRaw.map(normalizePortfolioDoc);

    return {
      sessions: activeItems.filter((i) => i.section === "TRAINING_SESSION"),
      sessionClips: activeItems.filter((i) => i.section === "SESSION_CLIP"),
      feedbackQuotes: activeItems.filter((i) => i.section === "FEEDBACK_QUOTE"),
      feedbackVideos: activeItems.filter((i) => i.section === "FEEDBACK_VIDEO"),
      photos: activeItems.filter((i) => i.section === "PHOTO"),
      videos: activeItems.filter((i) => i.section === "VIDEO"),
    };
  }

  /**
   * Count total active/non-deleted items.
   */
  async countTotal(filter = { isDeleted: false }) {
    return PortfolioItem.countDocuments(filter);
  }

  /**
   * Find highest PTF-xxxx numeric suffix for ID generation.
   */
  async getMaxIdSuffix() {
    const items = await PortfolioItem.find({}, { id: 1 }).lean();
    const nums = items
      .map((t) => {
        if (!t.id) return null;
        const match = t.id.match(/^PTF-(\d+)$/i) || t.id.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n) => n !== null && !isNaN(n));
    return nums.length ? Math.max(...nums) : 1000;
  }
}

module.exports = new PortfolioRepository();
