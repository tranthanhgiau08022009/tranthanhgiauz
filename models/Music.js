const mongoose = require('mongoose');

// Bai nhac nen cua web - luu link file (vd: https://files.catbox.moe/abc123.mp3)
const MusicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    url: { type: String, required: true, trim: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Music', MusicSchema);
