/**
 * Tu dong tao (hoac dong bo) tai khoan ADMIN rieng moi khi server khoi dong.
 * Cau hinh qua .env: ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD
 * - Chua co  -> tao moi voi role "admin"
 * - Da co    -> dam bao role "admin". Mat khau CHI bi dat lai khi ADMIN_RESET_PASSWORD=true
 *               (tranh viec moi lan restart server lai ghi de mat khau admin da tu doi)
 */
const User = require('../models/User');

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@shop.com').toLowerCase().trim();
  let username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 6) {
    console.warn('⚠️  Chua dat ADMIN_PASSWORD (>= 6 ky tu) trong .env -> bo qua tu dong tao admin.');
    return;
  }

  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    if (await User.findOne({ username })) username = `${username}_admin`;
    user = new User({ username, email, password, role: 'admin' });
    await user.save();
    console.log(`✅ Da tao tai khoan ADMIN: ${email}`);
    return;
  }

  let changed = false;
  if (user.role !== 'admin') { user.role = 'admin'; changed = true; }
  if (!user.isActive) { user.isActive = true; changed = true; }
  if (process.env.ADMIN_RESET_PASSWORD === 'true' && !(await user.comparePassword(password))) {
    user.password = password; changed = true;
  }
  if (changed) {
    await user.save();
    console.log(`✅ Da dong bo tai khoan ADMIN: ${email}`);
  }
}

module.exports = { ensureAdmin };
