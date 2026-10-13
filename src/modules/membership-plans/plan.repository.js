"use strict";

const MembershipPlan = require("./plan.model");

class PlanRepository {
  async findAll({ filter = {}, sort = { price: 1 } } = {}) {
    return MembershipPlan.find(filter).sort(sort).lean();
  }

  async findById(id) {
    return MembershipPlan.findOne({ id }).lean();
  }

  async findByName(name) {
    return MembershipPlan.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } }).lean();
  }

  async create(data) {
    const plan = new MembershipPlan(data);
    return (await plan.save()).toObject();
  }

  async updateById(id, updates) {
    return MembershipPlan.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", runValidators: false, lean: true }
    );
  }

  async deleteById(id) {
    return MembershipPlan.findOneAndDelete({ id });
  }
}

module.exports = new PlanRepository();
