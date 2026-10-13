"use strict";

const mongoose = require("mongoose");
const { PORTFOLIO_STATUS } = require("../../shared/constants");

const portfolioItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    section: {
      type: String,
      default: "TRAINING_SESSION",
      trim: true,
      index: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    authorName: {
      type: String,
      default: "",
      trim: true,
    },
    authorRole: {
      type: String,
      default: "",
      trim: true,
    },
    quote: {
      type: String,
      default: "",
      trim: true,
    },
    mediaUrl: {
      type: String,
      default: "",
      trim: true,
    },
    mediaType: {
      type: String,
      default: "",
      trim: true,
    },
    publicId: {
      type: String,
      default: "",
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      default: "",
      trim: true,
    },
    duration: {
      type: String,
      default: "",
      trim: true,
    },
    durationText: {
      type: String,
      default: "",
      trim: true,
    },
    level: {
      type: String,
      default: "All levels",
      trim: true,
    },
    icon: {
      type: String,
      default: "Dumbbell",
      trim: true,
    },
    iconKey: {
      type: String,
      default: "",
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    focusPosition: {
      type: String,
      default: "object-top",
      trim: true,
    },
    aspectRatio: {
      type: String,
      default: "",
      trim: true,
    },
    tag: {
      type: String,
      default: "",
      trim: true,
    },
    altText: {
      type: String,
      default: "",
      trim: true,
    },
    featuredOnHome: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(PORTFOLIO_STATUS),
      default: PORTFOLIO_STATUS.ACTIVE,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

portfolioItemSchema.index({ section: 1, isDeleted: 1, status: 1 });
portfolioItemSchema.index({ category: 1, isDeleted: 1, status: 1 });
portfolioItemSchema.index({ section: 1, order: 1 });

module.exports = mongoose.model("PortfolioItem", portfolioItemSchema);
