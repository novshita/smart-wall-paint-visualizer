const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true },
    favoriteColors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Color' }],
    favoritePatterns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pattern' }],
    lastLoginAt: Date,
    // Embedded in JWTs; bumping it (e.g. on password change) invalidates all older tokens
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model('User', userSchema);
