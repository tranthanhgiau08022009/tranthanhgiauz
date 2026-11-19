const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 8;

/** Tach data URL (data:image/png;base64,....) -> { mime, b64, buf } */
function parseDataUrl(str) {
  const m = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(str || ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  return { mime: m[1], b64: m[2], buf };
}

/** Luu danh sach data URL vao public/uploads, tra ve [{ url, mime, b64 }] */
async function saveImages(list) {
  if (!Array.isArray(list)) return [];
  if (list.length > MAX_IMAGES) {
    const e = new Error(`Toi da ${MAX_IMAGES} anh moi lan dang.`); e.status = 400; throw e;
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const out = [];
  for (const item of list) {
    const img = parseDataUrl(item);
    if (!img) { const e = new Error('Anh khong hop le (chi nhan PNG, JPG, WEBP, GIF).'); e.status = 400; throw e; }
    if (img.buf.length > MAX_BYTES) { const e = new Error('Moi anh toi da 5MB.'); e.status = 400; throw e; }
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${EXT[img.mime]}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, name), img.buf);
    out.push({ url: `/uploads/${name}`, mime: img.mime, b64: img.b64 });
  }
  return out;
}

module.exports = { saveImages, parseDataUrl };
