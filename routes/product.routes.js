const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const DigitalItem = require('../models/DigitalItem');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// =========================================================
// GET /api/products
// Danh sach san pham cong khai (KHONG bao gio tra secretContent)
// Ho tro loc theo category: ?category=canva|powerpoint|alight_motion|html_code
// =========================================================
router.get('/', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { isActive: true };

    if (category && category !== 'all') {
      filter.category = String(category);
    }
    if (search) {
      // Escape ky tu dac biet cua regex -> tim "(" hay "[" khong con gay loi 500
      const safe = String(search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: safe, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    // Tinh so luong con hang (available stock) cho moi san pham, khong lo secretContent
    const productIds = products.map((p) => p._id);
    const stockCounts = await DigitalItem.aggregate([
      { $match: { product: { $in: productIds }, isSold: false } },
      { $group: { _id: '$product', available: { $sum: 1 } } },
    ]);
    const stockMap = new Map(stockCounts.map((s) => [String(s._id), s.available]));

    const result = products.map((p) => ({
      ...p.toObject(),
      availableStock: stockMap.get(String(p._id)) || 0,
    }));

    res.json({
      products: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// GET /api/products/:slug  - chi tiet 1 san pham (bao gom subItems)
// =========================================================
router.get('/:slug', async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true });
    if (!product) {
      return res.status(404).json({ message: 'San pham khong ton tai.' });
    }
    const availableStock = await DigitalItem.countDocuments({
      product: product._id,
      isSold: false,
    });
    res.json({ product, availableStock });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// POST /api/products/buy
// Mua hang an toan, KHONG can MongoDB replica set:
//  1) Tru token bang 1 lenh nguyen tu co dieu kien (du so du moi tru) -> khong the am tien / mua trung
//  2) Khoa 1 DigitalItem chua ban bang findOneAndUpdate nguyen tu -> 2 nguoi khong the nhan trung 1 link
//  3) Neu buoc 2 that bai -> tu dong HOAN token
// Body: { productId }
// =========================================================
router.post('/buy', authMiddleware, async (req, res, next) => {
  const { productId } = req.body;
  if (!productId || !mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'productId khong hop le.' });
  }

  let charged = null; // { userId, amount }
  let delivered = false;

  const refund = async () => {
    if (charged && !delivered) {
      try {
        await User.updateOne({ _id: charged.userId }, { $inc: { tokenBalance: charged.amount } });
      } catch (e) {
        console.error('[REFUND FAILED] user', String(charged.userId), 'amount', charged.amount, e);
      }
      charged = null;
    }
  };

  try {
    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) {
      return res.status(404).json({ message: 'San pham khong ton tai hoac da ngung ban.' });
    }

    // Kiem tra con hang truoc de khong tru tien vo ich
    const hasStock = await DigitalItem.exists({ product: product._id, isSold: false });
    if (!hasStock) {
      return res.status(409).json({ message: 'San pham da het hang, vui long quay lai sau.' });
    }

    // 1) Tru token nguyen tu
    const price = product.priceToken;
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, tokenBalance: { $gte: price } },
      { $inc: { tokenBalance: -price } },
      { new: true }
    );
    if (!user) {
      return res.status(402).json({ message: 'So du Token khong du de mua san pham nay.' });
    }
    charged = { userId: user._id, amount: price };

    // 2) Khoa 1 item con hang
    const item = await DigitalItem.findOneAndUpdate(
      { product: product._id, isSold: false },
      { $set: { isSold: true, buyer: user._id, soldAt: new Date() } },
      { new: true, sort: { createdAt: 1 } }
    ).select('+secretContent');

    if (!item) {
      await refund();
      return res.status(409).json({ message: 'San pham vua het hang, token da duoc hoan lai.' });
    }
    delivered = true;

    // 3) Ghi so sach (loi o day khong duoc lam mat hang cua khach da tra tien)
    try {
      await Product.updateOne({ _id: product._id }, { $inc: { soldCount: 1 } });
      await Transaction.create({
        user: user._id,
        type: 'purchase',
        amountToken: price,
        product: product._id,
        status: 'success',
        note: `Mua san pham "${product.title}"`,
      });
    } catch (logErr) {
      console.error('[WARN] Khong ghi duoc lich su mua hang:', logErr);
    }

    const io = req.app.get('io');
    if (io) io.to(`user:${user._id}`).emit('balance:update', { tokenBalance: user.tokenBalance });

    res.json({
      message: 'Mua hang thanh cong!',
      secretContent: item.secretContent,
      newBalance: user.tokenBalance,
      product: { id: product._id, title: product.title },
    });
  } catch (err) {
    await refund();
    next(err);
  }
});

// =========================================================
// GET /api/products/me/history - lich su / kho luu tru ca nhan
// =========================================================
router.get('/me/history', authMiddleware, async (req, res, next) => {
  try {
    const items = await DigitalItem.find({ buyer: req.user._id, isSold: true })
      .select('+secretContent')
      .populate('product', 'title slug category previewImages')
      .sort({ soldAt: -1 });

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
