"use strict";

const Trainer = require("./trainer.model");

class TrainerRepository {
  async findAll({ filter = {}, skip = 0, limit = 50, sort = { id: 1 } } = {}) {
    const [data, total] = await Promise.all([
      Trainer.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Trainer.countDocuments(filter),
    ]);
    return { data, total };
  }

  async findById(id) {
    return Trainer.findOne({ id }).lean();
  }

  async findByEmail(email) {
    if (!email) return null;
    return Trainer.findOne({ email: email.toLowerCase().trim() }).lean();
  }

  async findByPhone(phone) {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, "");
    return Trainer.findOne({
      $or: [
        { phone },
        { phone: { $regex: clean.slice(-10) } },
      ],
    }).lean();
  }

  async create(data) {
    const trainer = new Trainer(data);
    return (await trainer.save()).toObject();
  }

  async updateById(id, updates) {
    return Trainer.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", runValidators: false, lean: true }
    );
  }

  async deleteById(id) {
    return Trainer.findOneAndDelete({ id });
  }

  async getMaxIdSuffix() {
    const trainers = await Trainer.find({}, { id: 1 }).lean();
    const nums = trainers
      .map((t) => {
        if (!t.id) return null;
        const match = t.id.match(/^TRN-(\d+)$/i);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n) => n !== null && !isNaN(n));

    return nums.length > 0 ? Math.max(...nums) : 100;
  }
}

module.exports = new TrainerRepository();

