const mongoose = require('mongoose');

const patternSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    category: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    tileSize: {
      width: { type: Number, min: 1 },
      height: { type: Number, min: 1 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

patternSchema.index({ category: 1 });

module.exports = mongoose.model('Pattern', patternSchema);
