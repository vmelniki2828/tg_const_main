const mongoose = require('mongoose');

// These are admin-panel accounts, independent of Telegram users.
const schema = new mongoose.Schema({
  login: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'superadmin'], required: true },
  isActive: { type: Boolean, default: true },
  sessionVersion: { type: Number, default: 0, select: false },
  mustChangePassword: { type: Boolean, default: false },
  createdBy: mongoose.Schema.Types.ObjectId,
  updatedBy: mongoose.Schema.Types.ObjectId,
  lastLoginAt: Date
}, { timestamps: true });

module.exports = { AdminAccount: mongoose.model('AdminAccount', schema) };
