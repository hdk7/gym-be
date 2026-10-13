"use strict";

const Member = require("./member.model");

class MemberRepository {
  async findAll({ filter = {}, skip = 0, limit = 10, sort = { registeredAt: -1 } } = {}) {
    const [data, total] = await Promise.all([
      Member.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Member.countDocuments(filter),
    ]);
    return { data, total };
  }

  async findById(id) {
    return Member.findOne({ id }).lean();
  }

  async findByEmail(email) {
    if (!email) return null;
    return Member.findOne({ email: email.toLowerCase().trim() }).lean();
  }

  async findByMobile(mobile) {
    if (!mobile) return null;
    const cleanMobile = mobile.replace(/\D/g, "");
    // Search both raw and cleaned format
    return Member.findOne({
      $or: [
        { mobile },
        { mobile: { $regex: cleanMobile.slice(-10) } },
      ],
    }).lean();
  }

  async create(data) {
    const member = new Member(data);
    return (await member.save()).toObject();
  }

  async updateById(id, updates) {
    return Member.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", runValidators: false, lean: true }
    );
  }

  async deleteById(id) {
    return Member.findOneAndDelete({ id });
  }

  async count(filter = {}) {
    return Member.countDocuments(filter);
  }

  async getMaxIdSuffix() {
    const members = await Member.find({}, { id: 1 }).lean();
    const nums = members
      .map((m) => {
        if (!m.id) return null;
        const match = m.id.match(/^MEM-(\d+)$/i);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n) => n !== null && !isNaN(n));

    return nums.length > 0 ? Math.max(...nums) : 2000;
  }
}

module.exports = new MemberRepository();

