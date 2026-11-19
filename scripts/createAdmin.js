/**
 * Script CLI: tao moi hoac nang quyen mot tai khoan len Admin.
 *
 * Cach dung:
 *   node scripts/createAdmin.js <email> [username] [password]
 *
 * Vi du:
 *   node scripts/createAdmin.js admin@shop.com admin MatKhauManh123
 *
 * Neu email da ton tai -> chi nang role len "admin".
 * Neu email chua ton tai -> tao moi user voi role "admin" (sinh mat khau ngau
 * nhien neu khong truyen password).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

function randomPassword() {
  return Math.random().toString(36).slice(-10) + '!1';
}

async function main() {
  const [, , emailArg, usernameArg, passwordArg] = process.argv;

  if (!emailArg) {
    console.error('❌ Thiếu email. Cách dùng: node scripts/createAdmin.js <email> [username] [password]');
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error('❌ Thiếu MONGO_URI trong file .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Đã kết nối MongoDB.');

  try {
    let user = await User.findOne({ email: emailArg.toLowerCase() });

    if (user) {
      user.role = 'admin';
      await user.save();
      console.log(`✅ Đã nâng quyền ADMIN cho user có sẵn: ${user.username} (${user.email})`);
    } else {
      const username = usernameArg || emailArg.split('@')[0];
      const password = passwordArg || randomPassword();

      user = await User.create({
        username,
        email: emailArg.toLowerCase(),
        password,
        role: 'admin',
      });

      console.log(`✅ Đã tạo mới tài khoản ADMIN: ${username} / ${user.email}`);
      if (!passwordArg) {
        console.log(`🔑 Mật khẩu tạm thời: ${password}`);
        console.log('   -> Hãy đăng nhập và đổi mật khẩu ngay sau đó.');
      }
    }

    console.log(`📌 Mã nạp tiền (rechargeCode): ${user.rechargeCode}`);
  } catch (err) {
    console.error('❌ Lỗi khi tạo/nâng quyền admin:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
