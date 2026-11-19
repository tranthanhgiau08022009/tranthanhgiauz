const express = require('express');
const slugify = require('slugify');
const Product = require('../models/Product');
const Music = require('../models/Music');
const DigitalItem = require('../models/DigitalItem');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { buildSalesStats } = require('../utils/analytics');
const { saveImages } = require('../utils/saveImage');

const router = express.Router();

// Tat ca route trong file nay yeu cau dang nhap + quyen admin
router.use(authMiddleware, adminMiddleware);

// =========================================================
// POST /api/admin/products - DANG SAN PHAM THU CONG
// Body: {
//   title, category, description, priceToken,
//   images: [dataURL...]        // anh tai len tu may (tuy chon, toi da 8)
//   previewImages: [url...]     // hoac URL anh co san (tuy chon)
//   demoUrl, features: [..],
//   secretContents: [link...]   // moi link = 1 luot ban trong kho
//   quantity: number            // chi khi chi co 1 link: ban N luot bang chung 1 link
// }
// =========================================================
const VALID_CATEGORIES = ['canva', 'powerpoint', 'alight_motion', 'html_code'];
const isHttp = (u) => /^https?:\/\//i.test(String(u || '').trim());
const MAX_QTY = 1000;
const toQty = (v, def = 1) => Math.min(MAX_QTY, Math.max(1, Math.trunc(Number(v)) || def));
const cleanList = (a, max) => (Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : []);

router.post('/products', async (req, res, next) => {
  try {
    const { category, demoUrl, subItems } = req.body;
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const priceToken = Number(req.body.priceToken);

    if (!title) return res.status(400).json({ message: 'Vui long nhap ten san pham.' });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Danh muc khong hop le.' });
    if (!Number.isFinite(priceToken) || priceToken < 0) return res.status(400).json({ message: 'Gia (token) khong hop le.' });

    const links = cleanList(req.body.secretContents, 500);
    if (!links.length) return res.status(400).json({ message: 'Can it nhat 1 link tai nguyen.' });
    if (!links.every(isHttp)) return res.status(400).json({ message: 'Moi link phai bat dau bang http:// hoac https://' });
    if (demoUrl && !isHttp(demoUrl)) return res.status(400).json({ message: 'Link demo phai bat dau bang http:// hoac https://' });

    // Anh: tai tu may (data URL) va/hoac URL co san
    const saved = await saveImages(req.body.images);
    const previewImages = [
      ...saved.map((x) => x.url),
      ...cleanList(req.body.previewImages, 8).filter((u) => isHttp(u) || u.startsWith('/uploads/')),
    ].slice(0, 8);

    const slug = slugify(title, { lower: true, strict: true }) || 'san-pham';
    const product = await Product.create({
      title: title.slice(0, 150),
      slug: `${slug}-${Date.now().toString(36)}`,
      category,
      description,
      priceToken: Math.round(priceToken),
      previewImages,
      demoUrl: String(demoUrl || '').trim(),
      features: cleanList(req.body.features, 10),
      subItems: Array.isArray(subItems)
        ? subItems.slice(0, 30).map((x) => ({ name: String(x.name || '').trim() || 'Mau', note: String(x.note || '') }))
        : [],
      isActive: true,
      createdByAI: false,
    });

    // 1 link + so luong N -> tao N luot ban cung 1 link. Nhieu link -> moi link 1 luot ban.
    const docs = links.length === 1
      ? Array.from({ length: toQty(req.body.quantity) }, () => ({ product: product._id, secretContent: links[0] }))
      : links.map((l) => ({ product: product._id, secretContent: l }));
    await DigitalItem.insertMany(docs);

    const io = req.app.get('io');
    if (io) io.emit('product:new', { product });

    res.status(201).json({ message: `Da dang ban "${product.title}" (${docs.length} luot ban).`, product });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// PUT /api/admin/products/:id - cap nhat san pham
// =========================================================
router.put('/products/:id', async (req, res, next) => {
  try {
    // Chi cho sua cac truong an toan (khong cho sua soldCount, slug...)
    const ALLOWED = ['title', 'category', 'description', 'priceToken', 'previewImages', 'demoUrl', 'subItems', 'isActive', 'features', 'tags', 'seoDescription'];
    const updates = {};
    ALLOWED.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: 'San pham khong ton tai.' });

    res.json({ message: 'Cap nhat thanh cong.', product });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// DELETE /api/admin/products/:id - go ban (soft delete)
// =========================================================
router.delete('/products/:id', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'San pham khong ton tai.' });
    res.json({ message: 'Da go san pham khoi cua hang.', product });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// POST /api/admin/products/:id/stock - bo sung kho hang thu cong
// Body: { secretContents: ["link1", "link2", ...] }
// =========================================================
router.post('/products/:id/stock', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'San pham khong ton tai.' });

    const links = cleanList(req.body.secretContents, 500);
    if (!links.length) return res.status(400).json({ message: 'Hay nhap it nhat 1 link.' });
    if (!links.every(isHttp)) return res.status(400).json({ message: 'Moi link phai bat dau bang http:// hoac https://' });

    // 1 link + quantity -> nhan ban N luot; nhieu link -> moi link 1 luot
    const docs = links.length === 1
      ? Array.from({ length: toQty(req.body.quantity) }, () => ({ product: product._id, secretContent: links[0] }))
      : links.map((content) => ({ product: product._id, secretContent: content }));
    await DigitalItem.insertMany(docs);

    res.status(201).json({ message: `Da them ${docs.length} don vi hang vao kho.` });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// PUT /api/admin/products/:id/stock - DAT SO LUONG KHO CON LAI = N
// Tang: nhan ban link san co cua san pham. Giam: xoa bot cac luot chua ban.
// Body: { quantity: N }  (0..1000)
// =========================================================
router.put('/products/:id/stock', async (req, res, next) => {
  try {
    const target = Math.trunc(Number(req.body.quantity));
    if (!Number.isFinite(target) || target < 0 || target > MAX_QTY) {
      return res.status(400).json({ message: `So luong phai tu 0 den ${MAX_QTY}.` });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'San pham khong ton tai.' });

    const unsold = await DigitalItem.find({ product: product._id, isSold: false }).select('_id').sort({ createdAt: -1 });
    const current = unsold.length;

    if (target > current) {
      // Lay 1 link mau (uu tien link chua ban, neu khong thi link da ban gan nhat)
      const template = await DigitalItem.findOne({ product: product._id })
        .select('+secretContent').sort({ isSold: 1, createdAt: -1 });
      if (!template) return res.status(400).json({ message: 'San pham chua co link nao. Hay them link bang nut "+ Kho".' });
      const docs = Array.from({ length: target - current }, () => ({ product: product._id, secretContent: template.secretContent }));
      await DigitalItem.insertMany(docs);
    } else if (target < current) {
      const ids = unsold.slice(0, current - target).map((d) => d._id);
      await DigitalItem.deleteMany({ _id: { $in: ids }, isSold: false });
    }

    res.json({ message: `Kho con lai: ${target}.`, availableStock: target });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// GET /api/admin/products - danh sach day du (ca an) cho admin
// =========================================================
router.get('/products', async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    const counts = await DigitalItem.aggregate([
      { $match: { isSold: false } },
      { $group: { _id: '$product', available: { $sum: 1 } } },
    ]);
    const map = new Map(counts.map((c) => [String(c._id), c.available]));
    res.json({
      products: products.map((p) => ({ ...p.toObject(), availableStock: map.get(String(p._id)) || 0 })),
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// GET /api/admin/transactions - xem toan bo giao dich he thong
// =========================================================
router.get('/transactions', async (req, res, next) => {
  try {
    const { type } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (type) filter.type = String(type);

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('user', 'username email')
        .populate('product', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.json({ transactions, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// GET /api/admin/users - danh sach nguoi dung
// =========================================================
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// PATCH /api/admin/users/:id/balance - admin dieu chinh so du thu cong
// =========================================================
router.patch('/users/:id/balance', async (req, res, next) => {
  try {
    const amount = Math.trunc(Number(req.body.amount));
    const reason = String(req.body.reason || '').slice(0, 200);
    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ message: 'So token khong hop le.' });
    }

    const current = await User.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'Nguoi dung khong ton tai.' });

    // Khong cho so du am: neu tru qua tay thi chi tru toi da bang so du hien co
    const delta = amount < 0 ? -Math.min(-amount, current.tokenBalance) : amount;
    const user = await User.findOneAndUpdate(
      amount < 0 ? { _id: current._id, tokenBalance: { $gte: -delta } } : { _id: current._id },
      { $inc: { tokenBalance: delta } },
      { new: true }
    );
    if (!user) return res.status(409).json({ message: 'So du vua thay doi, vui long thu lai.' });

    await Transaction.create({
      user: user._id,
      type: 'recharge',
      amountToken: delta,
      status: 'success',
      note: reason || 'Admin dieu chinh so du thu cong',
    });

    const io = req.app.get('io');
    if (io) io.to(`user:${user._id}`).emit('balance:update', { tokenBalance: user.tokenBalance });

    res.json({ message: 'Da cap nhat so du.', user });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// GET /api/admin/stats - so lieu tong hop thuan tuy (khong qua AI)
// Dung cho dashboard nhanh, va la du lieu nen cho /api/ai/analyze-sales
// =========================================================
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await buildSalesStats();
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// POST /api/admin/upload - tai anh len (data URL base64) -> tra ve danh sach URL
// =========================================================
router.post('/upload', async (req, res, next) => {
  try {
    const saved = await saveImages(req.body.images);
    res.status(201).json({ urls: saved.map((s) => s.url) });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// PATCH /api/admin/users/:id/active - khoa / mo khoa tai khoan
// =========================================================
router.patch('/users/:id/active', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Nguoi dung khong ton tai.' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Khong the khoa tai khoan admin.' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: user.isActive ? 'Da mo khoa.' : 'Da khoa tai khoan.', user });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// NHAC NEN (link Catbox)
// GET    /api/admin/music          - tat ca bai
// POST   /api/admin/music          - them nhieu bai: { tracks: [{ title?, url }] }
// PATCH  /api/admin/music/:id      - bat/tat hoac doi ten: { isActive?, title? }
// DELETE /api/admin/music/:id      - xoa bai
// =========================================================
router.get('/music', async (req, res, next) => {
  try {
    const tracks = await Music.find().sort({ createdAt: -1 });
    res.json({ tracks });
  } catch (err) {
    next(err);
  }
});

router.post('/music', async (req, res, next) => {
  try {
    const input = Array.isArray(req.body.tracks) ? req.body.tracks.slice(0, 200) : [];
    const seen = new Set();
    const docs = [];
    for (const t of input) {
      const url = String((t && t.url) || '').trim();
      if (!isHttp(url) || seen.has(url)) continue;
      seen.add(url);
      let title = String((t && t.title) || '').trim();
      if (!title) {
        try { title = decodeURIComponent(url.split('?')[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '')); } catch (e) { title = ''; }
      }
      docs.push({ title: (title || 'Bai nhac').slice(0, 150), url });
    }
    if (!docs.length) return res.status(400).json({ message: 'Khong co link hop le (phai bat dau bang http:// hoac https://).' });

    // Bo qua link da co trong kho nhac
    const existing = new Set((await Music.find({ url: { $in: docs.map((d) => d.url) } }).select('url')).map((m) => m.url));
    const fresh = docs.filter((d) => !existing.has(d.url));
    if (fresh.length) await Music.insertMany(fresh, { ordered: false });

    res.status(201).json({
      message: `Da them ${fresh.length} bai${docs.length - fresh.length ? `, bo qua ${docs.length - fresh.length} bai da co` : ''}.`,
      added: fresh.length,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/music/:id', async (req, res, next) => {
  try {
    const update = {};
    if (typeof req.body.isActive === 'boolean') update.isActive = req.body.isActive;
    if (typeof req.body.title === 'string' && req.body.title.trim()) update.title = req.body.title.trim().slice(0, 150);
    const track = await Music.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!track) return res.status(404).json({ message: 'Khong tim thay bai nhac.' });
    res.json({ message: 'Da cap nhat.', track });
  } catch (err) {
    next(err);
  }
});

router.delete('/music/:id', async (req, res, next) => {
  try {
    const track = await Music.findByIdAndDelete(req.params.id);
    if (!track) return res.status(404).json({ message: 'Khong tim thay bai nhac.' });
    res.json({ message: 'Da xoa bai nhac.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
