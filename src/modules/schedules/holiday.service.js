"use strict";

const scheduleRepository = require("./schedule.repository");
const { NotFoundError, ConflictError } = require("../../shared/apiError");

class HolidayService {
  async getAllHolidays({ search } = {}) {
    const filter = { isDeleted: false };
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, "i");
      filter.$or = [{ name: regex }, { type: regex }, { description: regex }];
    }
    return scheduleRepository.findAllHolidays({ filter });
  }

  async getHolidayById(id) {
    const holiday = await scheduleRepository.findHolidayById(id);
    if (!holiday || holiday.isDeleted) {
      throw new NotFoundError(`Holiday "${id}" not found.`);
    }
    return holiday;
  }

  async createHoliday(body) {
    let id = body.id?.trim();
    if (!id) {
      id = `HOL-${String(Date.now()).slice(-6)}`;
    }

    const existing = await scheduleRepository.findHolidayById(id);
    if (existing && !existing.isDeleted) {
      throw new ConflictError(`Holiday with ID "${id}" already exists.`);
    }

    return scheduleRepository.createHoliday({
      id,
      name: body.name.trim(),
      date: body.date.trim(),
      type: body.type || "Public Holiday",
      affectedBatches: body.affectedBatches || "ALL",
      description: body.description || "",
      status: body.status || "Active",
    });
  }

  async updateHoliday(id, updates) {
    const existing = await scheduleRepository.findHolidayById(id);
    if (!existing || existing.isDeleted) {
      throw new NotFoundError(`Holiday "${id}" not found.`);
    }
    delete updates.id;
    return scheduleRepository.updateHolidayById(id, updates);
  }

  async deleteHoliday(id) {
    const existing = await scheduleRepository.findHolidayById(id);
    if (!existing || existing.isDeleted) {
      throw new NotFoundError(`Holiday "${id}" not found.`);
    }
    await scheduleRepository.deleteHolidayById(id);
    return { id, message: `Holiday "${id}" deleted.` };
  }
}

module.exports = new HolidayService();
