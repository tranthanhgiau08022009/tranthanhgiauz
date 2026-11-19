const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Gioi han chat che cho dang nhap / dang ky de chong brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Qua nhieu lan thu, vui long doi 15 phut.' },
});

const COOKIE_NAME = process.env.COOKIE_NAME || 'dsp_token';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// =========================================================
// POST /api/auth/register
// =========================================================
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Vui long nhap day du thong tin.' });
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ message: 'Username phai tu 3 den 30 ky tu.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Email khong hop le.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Mat khau phai co it nhat 6 ky tu.' });
    }

    const existed = await User.findOne({ $or: [{ email }, { username }] });
    if (existed) {
      return res.status(409).json({ message: 'Email hoac Username da duoc su dung.' });
    }

    const user = await User.create({ username, email, password });
    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      message: 'Dang ky thanh cong.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        tokenBalance: user.tokenBalance,
        rechargeCode: user.rechargeCode,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// POST /api/auth/login
// =========================================================
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const emailOrUsername = String(req.body.emailOrUsername || '').trim();
    const password = String(req.body.password || '');
    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'Vui long nhap day du thong tin dang nhap.' });
    }

    const user = await User.findOne({
      $or: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }],
    }).select('+password');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Tai khoan khong ton tai hoac da bi khoa.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email/Username hoac mat khau khong dung.' });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.json({
      message: 'Dang nhap thanh cong.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        tokenBalance: user.tokenBalance,
        rechargeCode: user.rechargeCode,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// GET /api/auth/me  (kiem tra phien dang nhap hien tai)
// =========================================================
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

// =========================================================
// POST /api/auth/logout
// =========================================================
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ message: 'Da dang xuat.' });
});

// =========================================================
// POST /api/auth/change-password - doi mat khau (can mat khau cu)
// =========================================================
router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const oldPassword = String(req.body.oldPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!oldPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Mat khau moi toi thieu 6 ky tu.' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(oldPassword))) {
      return res.status(400).json({ message: 'Mat khau cu khong dung.' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Doi mat khau thanh cong.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
