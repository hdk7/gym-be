"use strict";

const Inquiry = require("./inquiry.model");

class InquiryRepository {
  async findAll({ filter = {}, sort = { createdAt: -1 } } = {}) {
    return Inquiry.find(filter).sort(sort).lean();
  }

  async findById(id) {
    return Inquiry.findOne({ id }).lean();
  }

  async create(data) {
    const inquiry = new Inquiry(data);
    return (await inquiry.save()).toObject();
  }

  async updateById(id, updates) {
    return Inquiry.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", runValidators: false, lean: true }
    );
  }

  async deleteById(id) {
    return Inquiry.findOneAndDelete({ id });
  }

  async count(filter = {}) {
    return Inquiry.countDocuments(filter);
  }

  async getMaxIdSuffix(year = new Date().getFullYear()) {
    const inquiries = await Inquiry.find({}, { id: 1 }).lean();
    const currentYearRegex = new RegExp(`^INQ-${year}-(\\d+)$`, "i");
    const generalRegex = /^INQ-(\d+)$/i;

    // Check year-scoped IDs first (e.g. INQ-2026-001)
    const yearNums = inquiries
      .map((i) => {
        if (!i.id) return null;
        const match = i.id.match(currentYearRegex);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n) => n !== null && !isNaN(n));

    if (yearNums.length > 0) {
      return Math.max(...yearNums);
    }

    // Fallback: check clean sequential numbers under 100,000 (ignoring legacy 9-digit timestamp seeds)
    const cleanNums = inquiries
      .map((i) => {
        if (!i.id) return null;
        const match = i.id.match(generalRegex);
        return match && parseInt(match[1], 10) < 100000 ? parseInt(match[1], 10) : null;
      })
      .filter((n) => n !== null && !isNaN(n));

    return cleanNums.length > 0 ? Math.max(...cleanNums) : 0;
  }
}

module.exports = new InquiryRepository();
