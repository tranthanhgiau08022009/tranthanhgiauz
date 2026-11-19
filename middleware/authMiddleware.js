const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * authMiddleware
 * Xac thuc nguoi dung qua JWT (Authorization: Bearer <token> hoac Cookie HttpOnly).
 */
async function authMiddleware(req, res, next) {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies[process.env.COOKIE_NAME || 'dsp_token']) {
      token = req.cookies[process.env.COOKIE_NAME || 'dsp_token'];
    }

    if (!token) {
      return res.status(401).json({ message: 'Ban can dang nhap de thuc hien thao tac nay.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Phien dang nhap khong hop le.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Tai khoan da bi khoa.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token khong hop le hoac da het han.' });
  }
}

/**
 * adminMiddleware
 * Phai dung SAU authMiddleware. Chi cho phep role === 'admin' di tiep.
 */
function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Ban khong co quyen truy cap chuc nang nay.' });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware };
