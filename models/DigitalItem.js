const mongoose = require('mongoose');

/**
 * DigitalItem la "kho hang" that su cho moi Product.
 * Moi ban ghi la MOT don vi hang hoa doc nhat (unique license / unique link),
 * giup chong ban trung khi nhieu nguoi mua dong thoi (is_sold flag + transaction).
 */
const DigitalItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    // Noi dung mat: link Canva, file tai, source code, key preset...
    secretContent: { type: String, required: true, select: false },

    isSold: { type: Boolean, default: false, index: true },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    soldAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index ho tro truy van "tim 1 item chua ban cua product X" that nhanh
DigitalItemSchema.index({ product: 1, isSold: 1 });

module.exports = mongoose.model('DigitalItem', DigitalItemSchema);
