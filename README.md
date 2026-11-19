# TRAN THANH GIAU (AI-Powered)

Nền tảng thương mại điện tử chuyên doanh sản phẩm số: **Mẫu Canva · Slide PowerPoint · Preset Alight Motion · Mã nguồn HTML/CSS/JS**, tích hợp **Google Gemini AI** để Admin đăng bán sản phẩm chỉ bằng một câu lệnh văn bản.

## 1. Yêu cầu hệ thống
- Node.js >= 18
- MongoDB (local hoặc MongoDB Atlas)
- API Key của Google Gemini (lấy tại https://aistudio.google.com/app/apikey)

## 2. Cài đặt

```bash
git clone <repo-url>
cd digital-store-pro
npm install
cp .env.example .env
```

Mở file `.env` và điền:
- `MONGO_URI` — chuỗi kết nối MongoDB của bạn
- `JWT_SECRET` — một chuỗi bí mật bất kỳ, càng dài càng an toàn
- `GEMINI_API_KEY` — API key Gemini để dùng tính năng AI Automation
- `WEBHOOK_SECRET` — secret dùng xác thực webhook ngân hàng (tùy nhà cung cấp)

## 3. Tạo tài khoản Admin đầu tiên

Dùng script có sẵn (khuyến nghị) — tự tạo mới hoặc nâng quyền nếu email đã tồn tại:

```bash
npm run seed:admin -- admin@yourdomain.com admin MatKhauManh123
# hoặc ngắn gọn: node scripts/createAdmin.js admin@yourdomain.com
```

Script sẽ in ra mật khẩu tạm (nếu không truyền sẵn) và mã nạp tiền `NAPxxxx` của tài khoản admin.

## 4. Chạy dự án

### Cách 1 — Chạy trực tiếp bằng Node

```bash
npm run dev      # chế độ phát triển (nodemon, tự reload)
# hoặc
npm start        # chế độ production
```

### Cách 2 — Chạy bằng Docker (khuyến nghị để triển khai)

```bash
docker compose up -d --build
```

Lệnh trên tự động dựng cả app lẫn MongoDB trong 1 mạng container, đọc biến môi trường từ file `.env`. Sau khi container chạy, tạo admin bằng:

```bash
docker compose exec app node scripts/createAdmin.js admin@yourdomain.com
```

### Cách 3 — Chạy production bằng PM2 (trên VPS)

```bash
npm install -g pm2
npm install --omit=dev
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

Truy cập: `http://localhost:5000`

## 5. Cấu trúc thư mục

```
digital-store-pro/
├── server.js                  # Khởi tạo Express, MongoDB, Socket.io
├── Dockerfile / docker-compose.yml / .dockerignore
├── ecosystem.config.js        # Cấu hình PM2 cho production
├── .github/workflows/ci.yml   # GitHub Actions: tự kiểm tra lỗi khi push
├── middleware/authMiddleware.js
├── models/ (User, Product, DigitalItem, Transaction, Message)
├── routes/ (auth, product, payment, admin, ai)
├── utils/analytics.js         # Tổng hợp số liệu thật cho dashboard & AI phân tích
├── scripts/createAdmin.js     # CLI tạo/nâng quyền tài khoản Admin
├── docs/API.md                # Tài liệu API chi tiết
└── public/ (index.html, style.css, script.js)
```

## 6. Luồng nghiệp vụ chính

### Mua hàng an toàn (`POST /api/products/buy`)
Không cần MongoDB replica set. Trừ token bằng 1 lệnh nguyên tử có điều kiện (đủ số dư mới trừ), rồi khóa 1 `DigitalItem` chưa bán bằng `findOneAndUpdate`; nếu hết hàng ở bước này thì tự hoàn token. Nhiều người mua cùng lúc không bao giờ nhận trùng 1 link.

### Webhook ngân hàng (`POST /api/payment/webhook`)
Trích mã `NAPxxxx` từ nội dung chuyển khoản, cộng token đúng user, chống xử lý lặp bằng unique index `bankTransactionId`. Xác thực bằng `WEBHOOK_SECRET` (HMAC `x-webhook-signature`, hoặc header `Authorization: Apikey <secret>`). Production mà thiếu `WEBHOOK_SECRET` thì webhook bị từ chối.

### Nhạc nền ngẫu nhiên (link Catbox)
Admin vào Bảng điều khiển → **Nhạc nền**, dán link file nhạc từ catbox.moe (mỗi dòng 1 bài, dạng `Tên bài | https://files.catbox.moe/abc.mp3` hoặc chỉ link). Khi khách vào web, trình phát ở góc phải dưới tự chọn ngẫu nhiên 1 bài, hết bài thì sang bài ngẫu nhiên khác. Trình duyệt chặn tự phát âm thanh nên nhạc sẽ bắt đầu ngay khi khách chạm/bấm vào trang lần đầu. Link hỏng sẽ tự bị bỏ qua.

### Giao diện RGB
Viền thẻ sản phẩm xoay màu, tên shop và tiêu đề chữ gradient chạy, nút chính phát sáng đổi màu, nền aurora đổi màu chậm. Tự tắt khi hệ điều hành bật "giảm chuyển động". Chỉnh trong cuối file `public/style.css`.

### Đăng sản phẩm thủ công (`POST /api/admin/products`) — chỉ Admin
Admin vào Bảng điều khiển → **Đăng sản phẩm**: nhập tên, danh mục, mô tả, tải ảnh, dán link tài nguyên (mỗi dòng = 1 lượt bán), đặt giá. Không dùng AI.

### 🤖 AI Phân tích doanh số (`POST /api/ai/analyze-sales`) — chỉ Admin
Tab **"Thống kê"** (nút AI là tuỳ chọn, cần `GEMINI_API_KEY`) trong bảng điều khiển Admin:
1. Backend tổng hợp số liệu **thật** từ MongoDB (`utils/analytics.js::buildSalesStats`) — doanh thu 7/30 ngày, top 5 sản phẩm bán chạy, tồn kho sắp hết, số lượng người dùng...
2. Số liệu này được gửi cho Gemini AI kèm `systemInstruction` yêu cầu **chỉ được nhận định dựa trên số liệu đã cho, tuyệt đối không bịa thêm con số mới**.
3. Gemini trả về JSON có cấu trúc: tóm tắt tổng quan, điểm nổi bật, nhận định sản phẩm bán chạy, gợi ý chiến lược giá, cảnh báo sắp hết hàng, cảnh báo rủi ro.
4. Giao diện hiển thị song song cả số liệu thô (thẻ thống kê + bảng top sản phẩm) và nhận định của AI, để Admin luôn đối chiếu được nguồn gốc con số.
5. Nếu cửa hàng chưa có giao dịch nào, hệ thống trả lời ngay mà **không gọi Gemini** (tiết kiệm chi phí API).

## 7. Bảo mật đã áp dụng
- `helmet` — HTTP security headers
- `express-rate-limit` — chống brute-force (login/register) & chống spam webhook
- `bcryptjs` (salt rounds = 10) — mã hóa mật khẩu
- `express-mongo-sanitize` — chống NoSQL Injection
- JWT lưu trong HttpOnly Cookie + hỗ trợ Bearer Header
- Trường `secretContent` luôn có `select: false` ở schema — không bao giờ lọt ra API public, chỉ trả về đúng người mua sau khi giao dịch transaction thành công

## 8. Đẩy lên GitHub

```bash
git init
git add .
git commit -m "Initial commit: TRAN THANH GIAU (AI-Powered)"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

> File `.env` đã được thêm vào `.gitignore` — **không bao giờ** commit API key hay secret thật lên GitHub. Hãy dùng `.env.example` làm mẫu tham khảo.

## 9. Gợi ý triển khai production
- Dùng MongoDB Atlas cho database (hoặc container `mongo` trong `docker-compose.yml` cho môi trường nhỏ/tự host).
- Deploy backend lên Render / Railway / VPS. Dùng `ecosystem.config.js` (PM2) hoặc `docker compose up -d` để giữ tiến trình chạy liên tục, tự restart khi crash.
- Cấu hình domain + SSL (Let's Encrypt / Cloudflare).
- Thiết lập webhook thật từ cổng thanh toán (Casso, SePay, VietQR...) trỏ về `/api/payment/webhook` và cập nhật `verifySignature()` cho đúng chuẩn chữ ký của nhà cung cấp đó.
- GitHub Actions (`.github/workflows/ci.yml`) đã được cấu hình sẵn: mỗi lần push/PR vào `main`, CI tự động kiểm tra cú pháp toàn bộ file `.js`, load thử các module chính, và build thử Docker image — giúp phát hiện lỗi trước khi merge.

## 10. Tài liệu tham khảo
- `docs/API.md` — Tổng hợp toàn bộ API endpoints, tham số, ví dụ response.

## Tính năng mới

- **Admin riêng tự động tạo** từ `ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD` trong `.env` (xem `CUSTOMIZE.md`, mục A).
- **AI tự đăng bán**: admin chỉ cần up link + ảnh + giá, Gemini nhìn ảnh, viết bài và đăng sản phẩm (xem mục B).
- Admin sửa giá / tên, thêm kho, ẩn/hiện sản phẩm ngay trên giao diện; quản lý người dùng (cộng trừ token, khoá tài khoản); đổi mật khẩu.
- Ảnh tải lên lưu tại `public/uploads/`.
