const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const TOKEN_RATE_VND = Number(process.env.TOKEN_RATE_VND || 1000);

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false; // timingSafeEqual nem loi neu khac do dai
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Xac thuc webhook. Chap nhan 1 trong cac cach pho bien:
 *  - Header x-webhook-signature = HMAC-SHA256(rawBody, WEBHOOK_SECRET) (hex)
 *  - Header Authorization: "Apikey <WEBHOOK_SECRET>"  (kieu SePay)
 *  - Header x-webhook-secret / secure-token = WEBHOOK_SECRET   (kieu Casso, tu cau hinh)
 * Production ma chua dat WEBHOOK_SECRET -> TU CHOI (tranh ai cung nap token free).
 */
function verifyWebhook(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';

  const sig = req.headers['x-webhook-signature'];
  if (sig && req.rawBody) {
    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    if (safeEqual(expected, sig)) return true;
  }
  const auth = req.headers.authorization;
  if (auth && safeEqual(auth, `Apikey ${secret}`)) return true;
  const plain = req.headers['x-webhook-secret'] || req.headers['secure-token'];
  if (plain && safeEqual(plain, secret)) return true;
  return false;
}

// =========================================================
// POST /api/payment/webhook
// Body: { transactionId|id, amount|transferAmount, content, transferType: "in" }
// content phai chua ma nap NAPxxxx cua user
// =========================================================
router.post('/webhook', webhookLimiter, async (req, res, next) => {
  try {
    if (!verifyWebhook(req)) {
      return res.status(401).json({ message: 'Chu ky webhook khong hop le.' });
    }

    const body = req.body || {};
    const transactionId = body.transactionId || body.id || body.referenceCode;
    const amount = Number(body.amount ?? body.transferAmount);
    const content = String(body.content || body.description || '');
    const transferType = body.transferType || 'in';

    if (transferType !== 'in') {
      return res.status(200).json({ message: 'Bo qua giao dich khong phai tien vao.' });
    }
    if (!transactionId || !Number.isFinite(amount) || amount <= 0 || !content) {
      return res.status(400).json({ message: 'Thieu du lieu webhook bat buoc.' });
    }
    const txId = String(transactionId);

    // Chong xu ly lap
    if (await Transaction.exists({ bankTransactionId: txId })) {
      return res.status(200).json({ message: 'Giao dich da duoc xu ly truoc do, bo qua.' });
    }

    const match = content.match(/NAP\d{3,8}/i);
    if (!match) {
      return res.status(200).json({ message: 'Khong tim thay ma nap tien hop le trong noi dung CK.' });
    }
    const rechargeCode = match[0].toUpperCase();

    const tokenAmount = Math.floor(amount / TOKEN_RATE_VND);
    if (tokenAmount <= 0) {
      return res.status(200).json({ message: 'So tien qua nho de quy doi Token.' });
    }

    const user = await User.findOne({ rechargeCode });
    if (!user) {
      // Tra 200 de cong thanh toan khong retry vo han; admin xu ly tay qua tab Nguoi dung
      console.warn(`[WEBHOOK] Khong tim thay user voi ma ${rechargeCode} (giao dich ${txId}, ${amount}d)`);
      return res.status(200).json({ message: `Khong tim thay user voi ma ${rechargeCode}.` });
    }

    // 1) Ghi giao dich truoc (bankTransactionId la unique -> 2 webhook trung nhau thi 1 cai that bai)
    let tx;
    try {
      tx = await Transaction.create({
        user: user._id,
        type: 'recharge',
        amountVnd: amount,
        amountToken: tokenAmount,
        bankTransactionId: txId,
        rechargeCode,
        status: 'success',
        note: `Nap tien tu dong qua webhook ngan hang (${content.slice(0, 120)})`,
      });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(200).json({ message: 'Giao dich da duoc xu ly truoc do, bo qua.' });
      }
      throw e;
    }

    // 2) Cong token nguyen tu. Neu loi -> xoa giao dich de cong thanh toan retry duoc
    let updated;
    try {
      updated = await User.findByIdAndUpdate(user._id, { $inc: { tokenBalance: tokenAmount } }, { new: true });
    } catch (e) {
      await Transaction.deleteOne({ _id: tx._id }).catch(() => {});
      throw e;
    }

    const io = req.app.get('io');
    if (io && updated) {
      io.to(`user:${user._id}`).emit('balance:update', { tokenBalance: updated.tokenBalance });
    }

    return res.status(200).json({ message: 'Da cong Token thanh cong.', tokenAmount });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// GET /api/payment/my-code
// =========================================================
router.get('/my-code', authMiddleware, async (req, res) => {
  res.json({ rechargeCode: req.user.rechargeCode });
});

// =========================================================
// GET /api/payment/history
// =========================================================
router.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const transactions = await Transaction.find({
      user: req.user._id,
      type: 'recharge',
    }).sort({ createdAt: -1 });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
