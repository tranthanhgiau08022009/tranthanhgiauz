require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { ensureAdmin } = require('./utils/seedAdmin');

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');
const aiRoutes = require('./routes/ai.routes');
const musicRoutes = require('./routes/music.routes');

const app = express();
const server = http.createServer(app);

// Chay sau reverse proxy (Render, Railway, Nginx, Cloudflare...) -> can de rate-limit/IP/cookie secure hoat dong dung
app.set('trust proxy', 1);

// ---------------------------------------------------------------------
// Socket.io - dung de push cap nhat so du Token / san pham moi real-time
// ---------------------------------------------------------------------
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', credentials: true },
});

// Xac thuc socket bang JWT (token gui qua auth hoac cookie) -> khong ai nghe len duoc so du cua nguoi khac.
// Khach chua dang nhap van ket noi duoc de nhan thong bao san pham moi, nhung khong vao phong rieng nao.
io.use((socket, next) => {
  try {
    let token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      const cookieName = process.env.COOKIE_NAME || 'dsp_token';
      const raw = socket.handshake.headers.cookie || '';
      const found = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(cookieName + '='));
      if (found) token = decodeURIComponent(found.slice(cookieName.length + 1));
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.id);
    }
  } catch (e) {
    // token sai/het han -> coi nhu khach
  }
  next();
});

io.on('connection', (socket) => {
  if (socket.userId) socket.join(`user:${socket.userId}`);
});

// Cho cac route khac co the truy cap io qua req.app.get('io')
app.set('io', io);

// ---------------------------------------------------------------------
// Bao mat & Middleware co ban
// ---------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: false, // tuy chinh CSP rieng neu can khi trien khai that
}));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
// Cac route nhan anh (base64) can gioi han body lon hon -> khai bao TRUOC parser mac dinh
app.use('/api/admin/upload', express.json({ limit: '30mb' }));
// Luu rawBody de xac thuc chu ky webhook thanh toan chinh xac
app.use(express.json({ limit: '2mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize()); // chong NoSQL Injection
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Gioi han tan suat chung cho toan bo API, chong DDoS co ban
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Qua nhieu yeu cau, vui long thu lai sau.' },
});
app.use('/api', globalLimiter);

// ---------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------
fs.mkdirSync(path.join(__dirname, 'public', 'uploads'), { recursive: true });
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/music', musicRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'tran-thanh-giau-shop', time: new Date().toISOString() });
});

// Fallback ve SPA index.html cho moi route frontend con lai
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------
// Xu ly loi tap trung
// ---------------------------------------------------------------------
app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Loi he thong, vui long thu lai.';

  if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map((e) => e.message).join('; '); }
  else if (err.name === 'CastError') { status = 400; message = 'Du lieu gui len khong hop le.'; }
  else if (err.code === 11000) { status = 409; message = 'Du lieu bi trung (da ton tai).'; }
  else if (err.type === 'entity.too.large') { status = 413; message = 'Du lieu gui len qua lon.'; }

  if (status >= 500) {
    console.error('[ERROR]', err);
    if (process.env.NODE_ENV === 'production') message = 'Loi he thong, vui long thu lai sau.';
  }
  if (res.headersSent) return next(err);
  res.status(status).json({ message });
});

// ---------------------------------------------------------------------
// Ket noi MongoDB & khoi chay server
// ---------------------------------------------------------------------
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('Thieu bien moi truong MONGO_URI trong file .env');
    }
    if (!process.env.JWT_SECRET) {
      throw new Error('Thieu bien moi truong JWT_SECRET trong file .env (dang nhap se bi loi neu thieu)');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Da ket noi MongoDB thanh cong.');
    await ensureAdmin(); // tu dong tao tai khoan admin rieng

    server.listen(PORT, () => {
      console.log(`🚀 TRAN THANH GIAU dang chay tai http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Khong the khoi dong server:', err.message);
    process.exit(1);
  }
}

start();

module.exports = { app, server, io };
