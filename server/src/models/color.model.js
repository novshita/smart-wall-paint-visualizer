const mongoose = require('mongoose');
const { hexToRgb } = require('../utils/color');

const FINISHES = ['matte', 'satin', 'glossy'];

const colorSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    hex: { type: String, required: true, uppercase: true, match: /^#[0-9A-F]{6}$/ },
    rgb: {
      r: { type: Number, min: 0, max: 255 },
      g: { type: Number, min: 0, max: 255 },
      b: { type: Number, min: 0, max: 255 },
    },
    brand: { type: String, trim: true, default: 'SWPV' },
    family: { type: String, required: true, trim: true },
    finishes: { type: [{ type: String, enum: FINISHES }], default: FINISHES },
    tags: [{ type: String, trim: true }],
    swatchUrl: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Keep rgb in sync with hex so both are always consistent (spec §23 rule 4)
// (document saves only; bulk/update paths such as the seed must set rgb themselves)
colorSchema.pre('validate', function syncRgb() {
  const rgb = hexToRgb(this.hex);
  if (rgb) this.rgb = rgb;
});

colorSchema.index({ name: 'text', code: 'text' });
colorSchema.index({ family: 1 });
colorSchema.index({ brand: 1 });

colorSchema.statics.FINISHES = FINISHES;

module.exports = mongoose.model('Color', colorSchema);
