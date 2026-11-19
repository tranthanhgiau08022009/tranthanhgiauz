const mongoose = require('mongoose');

const SubItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    thumbnail: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: true }
);

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    category: {
      type: String,
      required: true,
      enum: ['canva', 'powerpoint', 'alight_motion', 'html_code'],
    },
    description: { type: String, default: '' },
    priceToken: { type: Number, required: true, min: 0 },
    previewImages: [{ type: String }],
    demoUrl: { type: String, default: '' },
    // Noi dung AI viet them: diem noi bat, tu khoa, mo ta SEO
    features: [{ type: String }],
    tags: [{ type: String }],
    seoDescription: { type: String, default: '' },

    // Danh sach mau con / phien ban de khach chon trong modal chi tiet
    subItems: [SubItemSchema],

    soldCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    // Danh dau san pham duoc tao boi AI Automation (Gemini)
    createdByAI: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ProductSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model('Product', ProductSchema);
