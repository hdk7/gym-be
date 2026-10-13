"use strict";

const planRepository = require("./plan.repository");
const { NotFoundError, ConflictError } = require("../../shared/apiError");
const { PLAN_STATUS } = require("../../shared/constants");

class PlanService {
  async getAll({ includeDeleted = false, status } = {}) {
    const filter = {};
    if (!includeDeleted) filter.isDeleted = false;
    if (status && status !== "All") filter.status = status;

    return planRepository.findAll({ filter });
  }

  async getById(id) {
    const plan = await planRepository.findById(id);
    if (!plan) throw new NotFoundError(`Membership plan "${id}" not found.`);
    return plan;
  }

  async create(body) {
    const id = body.id || `plan-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const existing = await planRepository.findById(id);
    if (existing) throw new ConflictError(`Plan with ID "${id}" already exists.`);

    const formattedPrice = `₹${Number(body.price).toLocaleString("en-IN")}`;
    const period = body.period || (body.durationMonths === 1 ? "/mo" : `/${body.durationMonths}mo`);
    const billing = body.billing || `Billed ${formattedPrice} ${body.durationMonths === 1 ? "every month" : `every ${body.durationMonths} months`}`;

    return planRepository.create({
      id,
      name: body.name,
      durationMonths: Number(body.durationMonths),
      price: Number(body.price),
      formattedPrice,
      period,
      billing,
      description: body.description || "",
      badge: body.badge || null,
      popular: Boolean(body.popular),
      status: body.status || PLAN_STATUS.ACTIVE,
      features: Array.isArray(body.features) ? body.features : [],
    });
  }

  async update(id, body) {
    await this.getById(id);

    const updates = { ...body };
    if (body.price !== undefined) {
      updates.price = Number(body.price);
      updates.formattedPrice = `₹${updates.price.toLocaleString("en-IN")}`;
    }
    if (body.durationMonths !== undefined || body.price !== undefined) {
      const duration = body.durationMonths !== undefined ? Number(body.durationMonths) : 1;
      const priceStr = updates.formattedPrice || "";
      if (priceStr) {
        updates.billing = `Billed ${priceStr} ${duration === 1 ? "every month" : `every ${duration} months`}`;
      }
    }

    return planRepository.updateById(id, updates);
  }

  async softDelete(id) {
    const existing = await this.getById(id);
    if (existing.isDeleted) throw new ConflictError("Plan is already deleted.");
    return planRepository.updateById(id, {
      isDeleted: true,
      deletedAt: new Date(),
      status: PLAN_STATUS.INACTIVE,
    });
  }

  async restore(id) {
    const existing = await this.getById(id);
    if (!existing.isDeleted) throw new ConflictError("Plan is not deleted.");
    return planRepository.updateById(id, {
      isDeleted: false,
      deletedAt: null,
      status: PLAN_STATUS.ACTIVE,
    });
  }

  async toggleStatus(id) {
    const existing = await this.getById(id);
    const nextStatus = existing.status === PLAN_STATUS.ACTIVE ? PLAN_STATUS.INACTIVE : PLAN_STATUS.ACTIVE;
    return planRepository.updateById(id, { status: nextStatus });
  }

  async delete(id) {
    await this.getById(id);
    await planRepository.deleteById(id);
    return { id, deleted: true };
  }
}

module.exports = new PlanService();
