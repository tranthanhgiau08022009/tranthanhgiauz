# API Reference — TRAN THANH GIAU

Base URL (local): `http://localhost:5000/api`

Xác thực: gửi header `Authorization: Bearer <token>` **hoặc** để trình duyệt tự gửi HttpOnly cookie (`credentials: 'include'`).

---

## 🔐 Auth — `/auth`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | Public | Đăng ký tài khoản mới. Body: `{ username, email, password }` |
| POST | `/auth/login` | Public | Đăng nhập. Body: `{ emailOrUsername, password }` |
| GET | `/auth/me` | User | Lấy thông tin phiên đăng nhập hiện tại |
| POST | `/auth/logout` | Public | Xoá cookie phiên đăng nhập |

## 🛒 Products — `/products`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/products?category=&search=&page=&limit=` | Public | Danh sách sản phẩm công khai + tồn kho khả dụng |
| GET | `/products/:slug` | Public | Chi tiết 1 sản phẩm (gồm `subItems`) |
| POST | `/products/buy` | User | Mua sản phẩm — giao dịch nguyên tử. Body: `{ productId }` |
| GET | `/products/me/history` | User | Kho lưu trữ cá nhân — các sản phẩm đã mua kèm link tải |

## 💳 Payment — `/payment`

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/payment/webhook` | Webhook (ký bằng `WEBHOOK_SECRET`) | Nhận thông báo chuyển khoản, tự động cộng token |
| GET | `/payment/my-code` | User | Lấy mã nạp tiền `NAPxxxx` của tài khoản hiện tại |
| GET | `/payment/history` | User | Lịch sử nạp tiền của tài khoản hiện tại |

## 🛠️ Admin — `/admin` *(yêu cầu `role: admin`)*

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/admin/products` | Tạo sản phẩm thủ công (kèm `secretContents[]` để tạo kho hàng) |
| PUT | `/admin/products/:id` | Cập nhật sản phẩm |
| DELETE | `/admin/products/:id` | Gỡ bán (soft delete) |
| POST | `/admin/products/:id/stock` | Bổ sung kho hàng (`secretContents[]`) |
| POST | `/admin/products` | Admin | Đăng thủ công: `title, category, description, priceToken, images[] (data URL), secretContents[] (link), demoUrl?, features[]?` |
| GET | `/admin/products` | Danh sách đầy đủ sản phẩm (kèm tồn kho) |
| GET | `/admin/transactions?type=&page=&limit=` | Toàn bộ giao dịch hệ thống |
| GET | `/admin/users` | Danh sách người dùng |
| PATCH | `/admin/users/:id/balance` | Điều chỉnh số dư token thủ công. Body: `{ amount, reason }` |
| GET | `/admin/stats` | **Số liệu tổng hợp thuần** (doanh thu, top sản phẩm, tồn kho thấp...) — không qua AI |

## 🤖 AI Automation & Phân tích — `/ai` *(yêu cầu `role: admin`)*

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/ai/analyze-sales` | Gemini đọc số liệu thật (từ `buildSalesStats`) và trả về nhận định/khuyến nghị kinh doanh bằng JSON có cấu trúc |

### Response mẫu — `POST /ai/analyze-sales`

```json
{
  "stats": {
    "totalRevenueToken": 1240,
    "totalSalesCount": 38,
    "revenueLast7Days": 210,
    "topProducts": [{ "title": "Pitch Deck Khởi Nghiệp", "category": "powerpoint", "sales": 12, "totalToken": 480 }],
    "lowStockProducts": [{ "title": "Preset Cinematic Vlog", "available": 2 }]
  },
  "insights": {
    "summary": "Doanh thu tuần này tăng nhẹ, tập trung chủ yếu vào danh mục PowerPoint...",
    "highlights": ["..."],
    "topProductAdvice": "...",
    "pricingAdvice": "...",
    "restockAlerts": ["Preset Cinematic Vlog (còn 2)"],
    "riskWarnings": []
  }
}
```

> ⚠️ `insights` do AI tạo ra chỉ dựa trên số liệu trong `stats` — không được bịa thêm con số. Luôn hiển thị song song cả `stats` thô để Admin đối chiếu.

## ❤️ Health check

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra server còn sống — dùng cho Docker healthcheck / uptime monitor |

## Bổ sung (phiên bản mới)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/admin/upload` | Admin | Tải ảnh lên (`images[]` data URL) → trả về `urls[]` |
| PATCH | `/admin/users/:id/active` | Admin | Khoá / mở khoá tài khoản (không áp dụng cho admin) |
| POST | `/auth/change-password` | User | Đổi mật khẩu (`oldPassword`, `newPassword`) |

`PUT /admin/products/:id` chỉ nhận các trường: `title, category, description, priceToken, previewImages, demoUrl, subItems, isActive, features, tags, seoDescription`.


### Nhạc nền
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| GET | `/music` | Public | Danh sách bài đang bật `{ tracks: [{title,url}] }` |
| GET | `/admin/music` | Admin | Tất cả bài nhạc |
| POST | `/admin/music` | Admin | Thêm nhiều bài: `{ tracks: [{ title?, url }] }` |
| PATCH | `/admin/music/:id` | Admin | `{ isActive?, title? }` |
| DELETE | `/admin/music/:id` | Admin | Xoá bài |
