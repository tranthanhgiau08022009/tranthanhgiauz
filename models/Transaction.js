const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['recharge', 'purchase'],
      required: true,
    },
    amountVnd: { type: Number, default: 0 },
    amountToken: { type: Number, required: true },

    // Ma giao dich ngan hang / cong thanh toan, dung de chong xu ly lap webhook
    bankTransactionId: { type: String, unique: true, sparse: true, index: true },
    rechargeCode: { type: String, default: null },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'success',
    },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', TransactionSchema);
