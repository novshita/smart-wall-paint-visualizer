const mongoose = require('mongoose');

const { Schema } = mongoose;

const imageSchema = new Schema(
  {
    storageKey: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    mimeType: String,
    sizeBytes: Number,
  },
  { _id: false },
);

const selectionSchema = new Schema(
  {
    type: { type: String, enum: ['polygon', 'mask'], required: true },
    points: { type: [[Number]], default: undefined },
    maskUrl: String,
    feather: { type: Number, min: 0, max: 50, default: 0 },
  },
  { _id: false },
);

const styleSchema = new Schema(
  {
    mode: { type: String, enum: ['solid', 'dual', 'pattern'], default: 'solid' },
    colorId: { type: Schema.Types.ObjectId, ref: 'Color' },
    secondaryColorId: { type: Schema.Types.ObjectId, ref: 'Color' },
    customHex: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
    patternId: { type: Schema.Types.ObjectId, ref: 'Pattern' },
    split: {
      direction: { type: String, enum: ['horizontal', 'vertical'] },
      position: { type: Number, min: 0, max: 100 },
    },
    opacity: { type: Number, min: 0, max: 100, default: 100 },
    brightness: { type: Number, min: -100, max: 100, default: 0 },
    finish: { type: String, enum: ['matte', 'satin', 'glossy'], default: 'matte' },
    patternScale: { type: Number, min: 0.1, max: 10, default: 1 },
    patternRotation: { type: Number, min: -360, max: 360, default: 0 },
  },
  { _id: false },
);

const regionSchema = new Schema(
  {
    regionId: { type: String, required: true },
    name: { type: String, trim: true, maxlength: 100 },
    selection: { type: selectionSchema, required: true },
    style: { type: styleSchema, default: () => ({}) },
  },
  { _id: false },
);

const variantSchema = new Schema(
  {
    variantId: { type: String, required: true },
    name: { type: String, trim: true, maxlength: 100 },
    regions: { type: [regionSchema], default: [] },
    renderUrl: String,
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, maxlength: 150, default: 'Untitled design' },
    // Storage keys only; URLs are signed per request (see project.service toResponse)
    originalImage: { type: imageSchema, required: true },
    // Downscaled copy (max 2000px) used by the editor (FR-U5)
    workingImage: { type: imageSchema, required: true },
    thumbnail: { type: imageSchema, required: true },
    variants: { type: [variantSchema], default: [] },
    status: { type: String, enum: ['draft', 'saved'], default: 'draft' },
  },
  { timestamps: true },
);

projectSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
