# Hướng dẫn tuỳ chỉnh shop theo từng file

Tài liệu này liệt kê **chính xác file nào, dòng nào** cần sửa khi đổi sang shop của bạn.
Số dòng tính theo bản hiện tại; nếu đã sửa file thì dùng chuỗi "Tìm" để dò lại (Ctrl+F).

> Gợi ý: dùng chức năng **Find in Files** của VS Code, tìm `TRAN THANH GIAU` và `digital-store-pro` để đổi hàng loạt.

---

## A. Tài khoản admin riêng (tự động tạo)

Khai báo trong `.env` (hoặc biến môi trường Docker):

```
ADMIN_EMAIL=admin@shop.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MatKhauManhCuaBan123
```

- Mỗi lần server khởi động, hệ thống tự **tạo** admin nếu chưa có, hoặc **đồng bộ** lại (đặt lại quyền admin, cập nhật mật khẩu nếu bạn đổi `ADMIN_PASSWORD`).
- Đăng nhập trên web → nút ⚙ trên thanh menu → Bảng điều khiển.
- Có thể đổi mật khẩu ngay trong tab **Tài khoản**. Lưu ý: nếu sau đó bạn sửa `ADMIN_PASSWORD` trong `.env` thì mật khẩu sẽ bị đặt lại theo `.env`.

## B. Quy trình AI tự đăng bán

Bảng điều khiển → **AI tự đăng bán**:
1. Dán link tài nguyên (mỗi dòng 1 link = 1 lượt bán).
2. Chọn ảnh minh hoạ (tối đa 8; tự thu nhỏ trước khi gửi).
3. Nhập giá token (giá do bạn quyết định, AI không đổi).
4. (Tuỳ chọn) chọn danh mục, thêm ghi chú.
5. Bấm **AI viết bài và đăng bán** → Gemini nhìn ảnh + đọc link, viết tiêu đề, mô tả, điểm nổi bật, từ khoá SEO và đăng ngay.

Chỉnh giọng văn / quy tắc viết bài: sửa `AUTO_SYSTEM_INSTRUCTION` trong `routes/ai.routes.js`.
Sửa giá, thêm kho, ẩn/hiện sản phẩm: tab **Sản phẩm**. Cộng/trừ token, khoá user: tab **Người dùng**.
Ảnh được lưu ở `public/uploads/` (Docker đã gắn volume `uploads-data` để không mất ảnh).

---

## 0. Bảng thông tin cần chuẩn bị trước

| Thông tin | Ví dụ | Dùng ở file |
|---|---|---|
| Tên shop (hiển thị) | `Minh Anh Studio` | index.html, server.js, ai.routes.js, README.md, docs/API.md |
| Tên kỹ thuật (không dấu, viết thường, gạch ngang) | `minh-anh-studio` | package.json, docker-compose.yml, ecosystem.config.js, ci.yml, server.js |
| Slogan / tiêu đề trang | `Chợ tài nguyên số cho nhà sáng tạo` | index.html |
| Mô tả ngắn / lời chào | `Mẫu Canva, PowerPoint...` | index.html, package.json, README.md |
| Danh mục sản phẩm | Canva, PowerPoint, Alight Motion, HTML | index.html, script.js, Product.js, ai.routes.js |
| Năm bản quyền | `2026` | index.html |
| Ngân hàng + STK + tên chủ TK | `Vietcombank – 0123456789 – NGUYEN VAN A` | index.html (modal nạp token) – **hiện chưa có** |
| Liên hệ hỗ trợ (Zalo/Facebook/Email/Hotline) | `zalo.me/09xxxx` | index.html (chat widget, footer) – **hiện chưa có** |
| Tỉ lệ quy đổi | `1 token = 1.000 VNĐ` | .env, index.html |
| Tiền tố mã nạp | `NAP` (có thể đổi thành `MA`, `SHOP`...) | User.js, payment.routes.js |
| Màu thương hiệu | `#2DE2C8`, `#FF4FD8` | style.css |
| Email admin | `admin@shop.com` | lệnh `npm run seed:admin` |
| Domain | `https://shop.vn` | .env (CLIENT_URL) |

---

## 1. `public/index.html` — giao diện (QUAN TRỌNG NHẤT)

| Dòng | Nội dung hiện tại | Sửa thành |
|---|---|---|
| 6 | `<title>TRAN THANH GIAU — Chợ tài nguyên số...</title>` | Tên shop + slogan (hiện trên tab trình duyệt, Google) |
| 14 | `TRAN THANH GIAU` (logo ở thanh menu) | Tên shop |
| 34 | `Canva · PowerPoint · Alight Motion · Mã nguồn HTML` | Các loại sản phẩm shop bán |
| 35 | `Tài nguyên số chất lượng, giao ngay sau một cú click` | Tiêu đề chính (headline) của shop |
| 36 | `Mua mẫu Canva, slide thuyết trình...` | Đoạn giới thiệu shop |
| 43–45 | 3 thẻ nổi demo: `Bộ Story IG Pastel`, `Pitch Deck Khởi Nghiệp`, `Landing Page SaaS` (kèm số mẫu, giá token) | Đổi thành 3 sản phẩm tiêu biểu của bạn |
| 54–55 | `Toàn bộ sản phẩm` / `Lọc theo danh mục...` | Tiêu đề khu vực sản phẩm |
| 61–64 | Tên các nút lọc: `Mẫu Canva`, `Slide PowerPoint`, `Preset Alight Motion`, `Mã nguồn HTML` | Đổi **nhãn hiển thị** (giữ nguyên `data-cat="..."`, xem mục 6) |
| 77 | `© 2026 TRAN THANH GIAU. Mọi tài nguyên...` | Năm + tên shop + chính sách bản quyền |
| 78 | `Vận hành tự động với AI Automation (Google Gemini)` | Xoá hoặc thay bằng địa chỉ, MST, email, Zalo, Facebook |
| 127 | `Chuyển khoản ngân hàng với nội dung chứa đúng mã...` | **Thêm** ngân hàng, STK, tên chủ tài khoản ngay bên dưới đoạn này |
| 134 | `value="1.000 VNĐ = 1 Token"` | Khớp với `TOKEN_RATE_VND` trong `.env` |
| 203 | `title="Hỗ trợ trực tuyến"` (nút chat) | Tuỳ ý |
| 205 | `Hỗ trợ trực tuyến` (tiêu đề cửa sổ chat) | Tên bộ phận CSKH |
| 207 | `Xin chào! TRAN THANH GIAU có thể giúp gì cho bạn?` | Lời chào theo tên shop |

Mẫu thêm thông tin ngân hàng (chèn sau dòng 127):

```html
<div class="form-group">
  <label>Thông tin chuyển khoản</label>
  <input type="text" readonly value="Vietcombank - 0123456789 - NGUYEN VAN A">
</div>
```

---

## 2. `public/script.js` — logic giao diện

| Dòng | Hiện tại | Cần làm |
|---|---|---|
| 47–50 | Bảng nhãn danh mục: `canva: 'Mẫu Canva'`, `powerpoint: ...`, `alight_motion: ...`, `html_code: ...` | Đổi nhãn hiển thị trên thẻ sản phẩm cho khớp `index.html` |
| 66, 74, 92, 118, 133 | Khoá `localStorage` là `'dsp_token'` | Tuỳ chọn: đổi đồng bộ cả 5 chỗ nếu muốn khoá riêng cho shop |
| 326 | `${rechargeCode} nap tien` (ví dụ nội dung CK) | Đổi cụm `nap tien` nếu muốn |

## 3. `public/style.css` — màu sắc & font

| Dòng | Biến | Ý nghĩa |
|---|---|---|
| 1 | `@import ... Space Grotesk, Inter` | Font chữ (đổi nếu muốn font khác) |
| 4–18 | `--bg`, `--surface`, `--text` | Màu nền / chữ |
| 12–15 | `--neon-cyan` `#2DE2C8`, `--neon-pink` `#FF4FD8` | **Màu thương hiệu chính** – đổi tại đây là đổi toàn site |

---

## 4. `.env.example` → copy thành `.env` rồi điền

| Biến | Cần điền |
|---|---|
| `PORT` | Cổng chạy (mặc định 5000) |
| `CLIENT_URL` | Domain thật, ví dụ `https://shop.vn` (dòng 4) |
| `MONGO_URI` | Chuỗi kết nối MongoDB; đổi `<user>`, `<password>` và tên DB `digital_store_pro` (dòng 7) |
| `JWT_SECRET` | Chuỗi bí mật dài, ngẫu nhiên – **bắt buộc đổi** |
| `COOKIE_NAME` | Tuỳ chọn (mặc định `dsp_token`) |
| `GEMINI_API_KEY` | API key lấy tại Google AI Studio |
| `GEMINI_MODEL` | Giữ `gemini-2.5-flash` hoặc đổi model khác |
| `WEBHOOK_SECRET` | Secret khớp với cổng thanh toán (Casso/SePay...) – **bắt buộc đổi** |
| `TOKEN_RATE_VND` | 1 token = bao nhiêu VNĐ (mặc định 1000) |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Tài khoản admin tự động tạo (xem mục A) – **bắt buộc đổi mật khẩu** |

> Không commit file `.env` lên GitHub (đã nằm trong `.gitignore`).

---

## 5. Các file hạ tầng (đổi tên shop/tên kỹ thuật)

| File | Dòng | Sửa |
|---|---|---|
| `package.json` | 2, 4 | `name` và `description` |
| `docker-compose.yml` | 6, 13, 16, 27 | `container_name` (app, mongo), tên DB trong `MONGO_URI`, `COOKIE_NAME`; đồng thời điền `JWT_SECRET`, `GEMINI_API_KEY`, `WEBHOOK_SECRET` qua biến môi trường |
| `ecosystem.config.js` | 10 | `name` của tiến trình PM2 |
| `.github/workflows/ci.yml` | 49 | Tên image Docker `digital-store-pro:ci-test` |
| `Dockerfile` | — | Không bắt buộc sửa |
| `.dockerignore`, `.gitignore` | — | Không cần sửa |

## 6. Backend

| File | Dòng | Sửa |
|---|---|---|
| `server.js` | 79, 113 | `service: 'digital-store-pro'` (health check) và log `TRAN THANH GIAU dang chay...` |
| `routes/ai.routes.js` | 25, 55 | Tên shop trong prompt hệ thống của Gemini (`"TRAN THANH GIAU"`); có thể thêm **phong cách viết mô tả**, giọng điệu, quy tắc đặt giá riêng của shop |
| `routes/ai.routes.js` | 19 | `VALID_CATEGORIES` – danh sách danh mục hợp lệ |
| `models/Product.js` | 19 | `enum` danh mục – **phải trùng** `VALID_CATEGORIES` và `data-cat` trong `index.html` |
| `models/User.js` | 54 | Tiền tố mã nạp `'NAP'` |
| `routes/payment.routes.js` | 71 | Regex `/NAP\d{3,6}/i` – **phải khớp** tiền tố ở `User.js` |
| `routes/payment.routes.js` | 22–35 | Hàm `verifySignature`: sửa theo cổng thanh toán thật (Casso, SePay, VietQR...) |
| `routes/payment.routes.js` | 37–45 | Định dạng body webhook: đổi tên trường cho khớp nhà cung cấp |
| `scripts/createAdmin.js` | ví dụ ở đầu file | Chạy `npm run seed:admin -- admin@shop.com admin MatKhauManh123` bằng email/mật khẩu của bạn |

> Muốn thêm/bớt danh mục (ví dụ thêm `ebook`) thì phải sửa **đủ 5 nơi**:
> `index.html` (nút lọc) → `script.js` (nhãn) → `Product.js` (enum) → `ai.routes.js` (VALID_CATEGORIES + prompt) → `docs/API.md`.

## 7. Tài liệu

| File | Dòng | Sửa |
|---|---|---|
| `README.md` | 1, 3, 14, 72, 121 | Tên shop, mô tả, tên thư mục, thông điệp commit |
| `docs/API.md` | 1 | Tiêu đề `API Reference — ...` |

---

## 8. Checklist trước khi chạy thật

- [ ] Đổi tên shop ở `index.html`, `server.js`, `ai.routes.js`, README
- [ ] Thêm ngân hàng/STK và thông tin liên hệ vào `index.html`
- [ ] Copy `.env.example` → `.env`, điền đủ `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `WEBHOOK_SECRET`
- [ ] Tạo admin: `npm run seed:admin -- email username matkhau`
- [ ] Cấu hình webhook ở cổng thanh toán trỏ về `https://domain/api/payment/webhook`
- [ ] Đổi 3 thẻ demo ở hero thành sản phẩm thật
- [ ] Đổi màu thương hiệu trong `style.css`
- [ ] Chạy thử: `npm install && npm run dev`
