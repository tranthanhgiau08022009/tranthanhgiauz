(() => {
  'use strict';

  const API = '/api';
  let socket = null;
  const state = {
    user: null,
    token: null,
    category: 'all',
    search: '',
    products: [],
  };

  // =========================================================
  // Helpers
  // =========================================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
    el.textContent = message;
    $('#toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // Chi cho phep http(s) va /uploads/... -> chan javascript: va chen ma vao thuoc tinh HTML
  function safeUrl(u) {
    const url = String(u || '').trim();
    if (!/^(https?:\/\/|\/uploads\/)/i.test(url)) return '';
    return url.replace(/["'<>()\s]/g, (c) => encodeURIComponent(c));
  }
  function escapeAttr(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
  function closeModal(id) { $(`#${id}`).classList.add('hidden'); }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;

    const res = await fetch(`${API}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    }
    return data;
  }

  const CATEGORY_LABELS = {
    canva: 'Mẫu Canva',
    powerpoint: 'Slide PowerPoint',
    alight_motion: 'Preset Alight Motion',
    html_code: 'Mã nguồn HTML',
  };

  // =========================================================
  // AUTH
  // =========================================================
  function updateAuthUI() {
    const loggedIn = !!state.user;
    $('#login-nav-btn').classList.toggle('hidden', loggedIn);
    $('#logout-nav-btn').classList.toggle('hidden', !loggedIn);
    $('#admin-btn').classList.toggle('hidden', !(loggedIn && state.user.role === 'admin'));
    $('#token-balance').textContent = loggedIn ? state.user.tokenBalance : 0;
  }

  async function restoreSession() {
    try {
      const saved = localStorage.getItem('dsp_token');
      if (!saved) return;
      state.token = saved;
      const data = await api('/auth/me');
      state.user = data.user;
      updateAuthUI();
      connectSocket();
    } catch (err) {
      localStorage.removeItem('dsp_token');
      state.token = null;
    }
  }

  async function login() {
    const emailOrUsername = $('#login-identifier').value.trim();
    const password = $('#login-password').value;
    const errEl = $('#login-error');
    errEl.classList.add('hidden');

    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername, password }),
      });
      state.user = data.user;
      state.token = data.token;
      localStorage.setItem('dsp_token', data.token);
      updateAuthUI();
      connectSocket();
      closeModal('auth-modal');
      toast(`Chào mừng trở lại, ${data.user.username}!`);
      loadProducts();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  }

  async function register() {
    const username = $('#register-username').value.trim();
    const email = $('#register-email').value.trim();
    const password = $('#register-password').value;
    const errEl = $('#register-error');
    errEl.classList.add('hidden');

    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      state.user = data.user;
      state.token = data.token;
      localStorage.setItem('dsp_token', data.token);
      updateAuthUI();
      connectSocket();
      closeModal('auth-modal');
      toast('Tạo tài khoản thành công!');
      loadProducts();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  }

  function disconnectSocket() {
    if (socket) { socket.disconnect(); socket = null; }
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
    disconnectSocket();
    state.user = null;
    state.token = null;
    localStorage.removeItem('dsp_token');
    updateAuthUI();
    toast('Đã đăng xuất.');
  }

  // =========================================================
  // SOCKET.IO - realtime token balance & san pham moi
  // =========================================================
  function connectSocket() {
    if (socket || !window.io) return;
    socket = io({ autoConnect: true, auth: { token: state.token } });
    socket.on('balance:update', ({ tokenBalance }) => {
      if (state.user) {
        state.user.tokenBalance = tokenBalance;
        $('#token-balance').textContent = tokenBalance;
        toast(`Số dư token đã được cập nhật: ${tokenBalance}`);
      }
    });
    socket.on('product:new', ({ product }) => {
      toast(`Sản phẩm mới vừa lên sàn: ${product.title}`);
      loadProducts();
    });
  }

  // =========================================================
  // PRODUCTS
  // =========================================================
  function renderProductCard(p) {
    const thumb = p.previewImages && p.previewImages[0];
    const low = p.availableStock <= 3;
    return `
      <article class="card" data-id="${escapeAttr(p._id)}" data-slug="${escapeAttr(p.slug)}">
        <div class="card-thumb" style="${safeUrl(thumb) ? `background-image:url('${safeUrl(thumb)}')` : ''}">
          <span class="cat-badge">${escapeHtml(CATEGORY_LABELS[p.category] || p.category)}</span>
          ${safeUrl(thumb) ? '' : '<span class="ph">Chưa có ảnh xem trước</span>'}
        </div>
        <div class="card-body">
          <h3>${escapeHtml(p.title)}</h3>
          <p class="desc">${escapeHtml(p.description || '')}</p>
          <div class="card-foot">
            <span class="price">${p.priceToken} token</span>
            <span class="stock-note ${low ? 'low' : ''}">${p.availableStock > 0 ? `Còn ${p.availableStock}` : 'Hết hàng'}</span>
          </div>
        </div>
      </article>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadProducts() {
    const grid = $('#product-grid');
    try {
      const qs = new URLSearchParams();
      if (state.category !== 'all') qs.set('category', state.category);
      if (state.search) qs.set('search', state.search);

      const data = await api(`/products?${qs.toString()}`);
      state.products = data.products;

      if (!data.products.length) {
        grid.innerHTML = `<div class="empty-state">Chưa có sản phẩm nào trong danh mục này.</div>`;
        return;
      }
      grid.innerHTML = data.products.map(renderProductCard).join('');

      $$('.card').forEach((card) => {
        card.addEventListener('click', () => openProductDetail(card.dataset.slug));
      });
    } catch (err) {
      grid.innerHTML = `<div class="empty-state">Không thể tải sản phẩm: ${escapeHtml(err.message)}<br><small style="color:var(--muted)">(Kiểm tra server backend & MongoDB đã chạy chưa)</small></div>`;
    }
  }

  async function openProductDetail(slug) {
    openModal('product-modal');
    const content = $('#product-detail-content');
    content.innerHTML = 'Đang tải...';
    try {
      const { product, availableStock } = await api(`/products/${slug}`);
      const gallery = (product.previewImages || []).slice(0, 4)
        .filter((img) => safeUrl(img))
        .map((img) => `<img src="${safeUrl(img)}" alt="${escapeAttr(product.title)}">`).join('')
        || `<div class="card-thumb"><span class="ph">Chưa có ảnh xem trước</span></div>`;

      const subItemsHtml = (product.subItems || []).length
        ? `<div class="subitem-list">${product.subItems.map((s) => `
            <div class="subitem">
              ${safeUrl(s.thumbnail) ? `<img src="${safeUrl(s.thumbnail)}" alt="">` : ''}
              <div><strong>${escapeHtml(s.name)}</strong>${s.note ? `<div style="color:var(--muted)">${escapeHtml(s.note)}</div>` : ''}</div>
            </div>`).join('')}</div>`
        : '';

      content.innerHTML = `
        <h2>${escapeHtml(product.title)}</h2>
        <div class="pd-grid">
          <div class="pd-gallery">${gallery}</div>
          <div>
            <p style="color:var(--muted); font-size:.9rem;">${escapeHtml(product.description || '')}</p>
            ${safeUrl(product.demoUrl) ? `<p><a href="${safeUrl(product.demoUrl)}" target="_blank" rel="noopener" style="color:var(--neon-cyan)">Xem bản demo trước khi mua</a></p>` : ''}
            ${(product.features || []).length ? `<ul style="padding-left:18px;font-size:.88rem">${product.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
            ${subItemsHtml}
            <div class="pd-price-row">
              <span class="price">${product.priceToken} token</span>
              <span class="stock-note ${availableStock <= 3 ? 'low' : ''}">${availableStock > 0 ? `Còn ${availableStock} sản phẩm` : 'Hết hàng'}</span>
            </div>
            <button class="btn btn-primary btn-block" id="buy-now-btn" ${availableStock <= 0 ? 'disabled' : ''}>
              ${availableStock > 0 ? 'Mua ngay' : 'Hết hàng'}
            </button>
          </div>
        </div>`;

      const buyBtn = $('#buy-now-btn');
      if (buyBtn && availableStock > 0) {
        buyBtn.addEventListener('click', () => buyProduct(product._id));
      }
    } catch (err) {
      content.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  async function buyProduct(productId) {
    if (!state.user) {
      closeModal('product-modal');
      openModal('auth-modal');
      toast('Vui lòng đăng nhập để mua hàng.', 'error');
      return;
    }
    try {
      const data = await api('/products/buy', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      state.user.tokenBalance = data.newBalance;
      $('#token-balance').textContent = data.newBalance;
      toast('Mua hàng thành công! Nội dung đã được lưu vào Kho của tôi.');
      closeModal('product-modal');
      loadProducts();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // =========================================================
  // LIBRARY (Kho ca nhan)
  // =========================================================
  async function openLibrary() {
    if (!state.user) {
      openModal('auth-modal');
      toast('Vui lòng đăng nhập để xem kho của bạn.', 'error');
      return;
    }
    openModal('library-modal');
    const content = $('#library-content');
    content.innerHTML = 'Đang tải...';
    try {
      const { items } = await api('/products/me/history');
      if (!items.length) {
        content.innerHTML = `<div class="empty-state">Bạn chưa mua sản phẩm nào.</div>`;
        return;
      }
      content.innerHTML = items.map((it) => `
        <div class="lib-item">
          ${safeUrl(it.product?.previewImages?.[0]) ? `<img src="${safeUrl(it.product.previewImages[0])}" alt="">` : '<div style="width:64px;height:64px;background:var(--surface-alt)"></div>'}
          <div class="meta">
            <h4>${escapeHtml(it.product?.title || 'Sản phẩm đã gỡ')}</h4>
            <div class="link">${escapeHtml(it.secretContent)}</div>
          </div>
          ${safeUrl(it.secretContent) ? `<a class="btn btn-sm" href="${safeUrl(it.secretContent)}" target="_blank" rel="noopener noreferrer">Mở / Tải</a>` : ''}
        </div>`).join('');
    } catch (err) {
      content.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // =========================================================
  // RECHARGE
  // =========================================================
  async function openRecharge() {
    if (!state.user) {
      openModal('auth-modal');
      toast('Vui lòng đăng nhập để nạp token.', 'error');
      return;
    }
    openModal('recharge-modal');
    try {
      const { rechargeCode } = await api('/payment/my-code');
      $('#recharge-code').value = rechargeCode;
      $('#recharge-example').textContent = `${rechargeCode}`;
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // =========================================================
  // ADMIN PANEL - AI Automation
  // =========================================================
  async function openAdmin() {
    openModal('admin-modal');
    loadAdminProducts();
    loadAdminTransactions();
    loadAdminUsers();
  }

  async function loadAdminProducts() {
    const el = $('#admin-products-list');
    try {
      const { products } = await api('/admin/products');
      el.innerHTML = `
        <div style="overflow-x:auto"><table class="admin-table">
          <thead><tr><th>Tên</th><th>Giá (token)</th><th>Kho</th><th>Đã bán</th><th>Nguồn</th><th></th></tr></thead>
          <tbody>
            ${products.map((p) => `
              <tr data-pid="${escapeAttr(p._id)}">
                <td><input class="ap-title" value="${escapeAttr(p.title)}" style="min-width:180px">
                    <div style="color:var(--muted)">${escapeHtml(CATEGORY_LABELS[p.category] || p.category)}${p.isActive ? '' : ' · đang ẩn'}</div></td>
                <td><input class="ap-price" type="number" min="0" value="${p.priceToken}" style="width:80px"></td>
                <td style="white-space:nowrap"><input class="ap-stock" type="number" min="0" max="1000" value="${p.availableStock}" style="width:70px">
                    <button class="btn btn-ghost btn-sm" data-act="setstock" title="Đặt số lượng còn lại (nhân bản link có sẵn)">Đặt</button></td>
                <td>${p.soldCount}</td>
                <td>${p.createdByAI ? 'AI (cũ)' : 'Thủ công'}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn-primary btn-sm" data-act="save">Lưu</button>
                  <button class="btn btn-ghost btn-sm" data-act="stock">+ Kho</button>
                  <button class="btn btn-ghost btn-sm" data-act="toggle" data-active="${p.isActive}">${p.isActive ? 'Ẩn' : 'Hiện'}</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  async function onAdminProductClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const row = btn.closest('tr');
    const id = row.dataset.pid;
    try {
      if (btn.dataset.act === 'save') {
        await api(`/admin/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: row.querySelector('.ap-title').value.trim(),
            priceToken: Number(row.querySelector('.ap-price').value),
          }),
        });
        toast('Đã lưu thay đổi.');
      } else if (btn.dataset.act === 'setstock') {
        const quantity = Number(row.querySelector('.ap-stock').value);
        const r = await api(`/admin/products/${id}/stock`, { method: 'PUT', body: JSON.stringify({ quantity }) });
        toast(r.message);
      } else if (btn.dataset.act === 'stock') {
        const text = prompt('Dán link giao cho khách (mỗi dòng 1 link = 1 lượt bán):');
        if (!text) return;
        const secretContents = text.split('\n').map((x) => x.trim()).filter(Boolean);
        let quantity = 1;
        if (secretContents.length === 1) {
          quantity = Number(prompt('Bán link này bao nhiêu lượt?', '1')) || 1;
        }
        const r = await api(`/admin/products/${id}/stock`, { method: 'POST', body: JSON.stringify({ secretContents, quantity }) });
        toast(r.message);
      } else if (btn.dataset.act === 'toggle') {
        await api(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify({ isActive: btn.dataset.active !== 'true' }) });
        toast('Đã cập nhật trạng thái.');
      }
      loadAdminProducts();
      loadProducts();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // =========================================================
  // ADMIN - Nguoi dung, doi mat khau
  // =========================================================
  async function loadAdminUsers() {
    const el = $('#admin-users-list');
    try {
      const { users } = await api('/admin/users');
      el.innerHTML = `
        <div style="overflow-x:auto"><table class="admin-table">
          <thead><tr><th>Tên</th><th>Email</th><th>Token</th><th>Mã nạp</th><th></th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr data-uid="${escapeAttr(u._id)}">
                <td>${escapeHtml(u.username)}${u.role === 'admin' ? ' 👑' : ''}${u.isActive ? '' : ' (khoá)'}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${u.tokenBalance}</td>
                <td>${escapeHtml(u.rechargeCode || '')}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn-ghost btn-sm" data-uact="balance">± Token</button>
                  ${u.role === 'admin' ? '' : `<button class="btn btn-ghost btn-sm" data-uact="active">${u.isActive ? 'Khoá' : 'Mở khoá'}</button>`}
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  async function onAdminUserClick(e) {
    const btn = e.target.closest('[data-uact]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.uid;
    try {
      if (btn.dataset.uact === 'balance') {
        const amount = Number(prompt('Số token cộng thêm (số âm để trừ):', '0'));
        if (!amount) return;
        await api(`/admin/users/${id}/balance`, { method: 'PATCH', body: JSON.stringify({ amount, reason: 'Admin điều chỉnh thủ công' }) });
      } else {
        await api(`/admin/users/${id}/active`, { method: 'PATCH' });
      }
      toast('Đã cập nhật.');
      loadAdminUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function changePassword() {
    try {
      const r = await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword: $('#pw-old').value, newPassword: $('#pw-new').value }),
      });
      $('#pw-old').value = ''; $('#pw-new').value = '';
      toast(r.message);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // =========================================================
  // ADMIN - DANG SAN PHAM THU CONG: anh + noi dung + link
  // =========================================================
  // Thu nho anh (toi da 1280px, JPEG) truoc khi gui de nhe va nhanh
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
      reader.onload = () => {
        if (file.type === 'image/gif') return resolve(reader.result);
        const img = new Image();
        img.onerror = () => reject(new Error('File ảnh không hợp lệ.'));
        img.onload = () => {
          const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function previewPostImages() {
    const files = Array.from($('#pp-images').files).slice(0, 8);
    $('#pp-previews').innerHTML = files.map((f) =>
      `<img src="${URL.createObjectURL(f)}" alt="" style="width:64px;height:64px;object-fit:cover;border:1px solid var(--border)">`).join('');
  }

  async function manualPublish() {
    const status = $('#pp-status');
    const btn = $('#pp-btn');
    const title = $('#pp-title').value.trim();
    const links = $('#pp-links').value.split('\n').map((x) => x.trim()).filter(Boolean);
    const price = $('#pp-price').value;
    if (!title) return toast('Hãy nhập tên sản phẩm.', 'error');
    if (!links.length) return toast('Hãy dán ít nhất 1 link tài nguyên.', 'error');
    if (!links.every((l) => /^https?:\/\//i.test(l))) return toast('Mỗi link phải bắt đầu bằng http:// hoặc https://', 'error');
    if (price === '' || Number(price) < 0) return toast('Hãy nhập giá hợp lệ.', 'error');

    btn.disabled = true;
    btn.textContent = 'Đang đăng...';
    status.classList.add('hidden');
    try {
      const files = Array.from($('#pp-images').files).slice(0, 8);
      const images = await Promise.all(files.map(fileToDataUrl));
      const data = await api('/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category: $('#pp-category').value,
          description: $('#pp-desc').value.trim(),
          features: $('#pp-features').value.split('\n').map((x) => x.trim()).filter(Boolean),
          images,
          secretContents: links,
          quantity: Number($('#pp-qty').value) || 1,
          demoUrl: $('#pp-demo').value.trim(),
          priceToken: Number(price),
        }),
      });
      status.className = 'alert alert-success';
      status.textContent = data.message;
      ['#pp-title', '#pp-desc', '#pp-features', '#pp-links', '#pp-demo'].forEach((id) => { $(id).value = ''; });
      $('#pp-qty').value = 1;
      $('#pp-images').value = ''; $('#pp-previews').innerHTML = '';
      loadProducts();
      loadAdminProducts();
    } catch (err) {
      status.className = 'alert alert-error';
      status.textContent = err.message;
    } finally {
      status.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Đăng bán';
    }
  }

  async function loadAdminTransactions() {
    const el = $('#admin-transactions-list');
    try {
      const { transactions } = await api('/admin/transactions?limit=30');
      el.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Người dùng</th><th>Loại</th><th>Token</th><th>Ghi chú</th></tr></thead>
          <tbody>
            ${transactions.map((t) => `
              <tr>
                <td>${escapeHtml(t.user?.username || '—')}</td>
                <td>${t.type === 'recharge' ? 'Nạp tiền' : 'Mua hàng'}</td>
                <td>${t.amountToken}</td>
                <td>${escapeHtml(t.note || '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // =========================================================
  // ADMIN PANEL - Phan tich AI (AI phan tich doanh so dua tren so lieu that)
  // =========================================================
  function renderStatBoxes(stats) {
    const boxes = [
      { label: 'Tổng doanh thu (token)', value: stats.totalRevenueToken },
      { label: 'Tổng đơn hàng', value: stats.totalSalesCount },
      { label: 'Doanh thu 7 ngày qua', value: stats.revenueLast7Days },
      { label: 'Đơn hàng 7 ngày qua', value: stats.salesLast7Days },
      { label: 'Doanh thu 30 ngày qua', value: stats.revenueLast30Days },
      { label: 'Sản phẩm đang bán', value: stats.totalActiveProducts },
      { label: 'Tổng người dùng', value: stats.totalUsers },
    ];
    return `<div class="stat-grid">${boxes.map((b) => `
      <div class="stat-box"><div class="num">${b.value}</div><div class="label">${b.label}</div></div>`).join('')}</div>`;
  }

  function renderList(items, emptyText) {
    if (!items || !items.length) {
      return `<ul class="empty-list"><li>${escapeHtml(emptyText)}</li></ul>`;
    }
    return `<ul>${items.map((it) => `<li>${escapeHtml(typeof it === 'string' ? it : JSON.stringify(it))}</li>`).join('')}</ul>`;
  }

  function renderTopProductsTable(topProducts) {
    if (!topProducts || !topProducts.length) {
      return `<p style="color:var(--muted); font-size:.85rem;">Chưa có dữ liệu sản phẩm bán chạy.</p>`;
    }
    return `
      <table class="admin-table">
        <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Lượt bán</th><th>Doanh thu (token)</th></tr></thead>
        <tbody>
          ${topProducts.map((p) => `
            <tr>
              <td>${escapeHtml(p.title)}</td>
              <td>${escapeHtml(CATEGORY_LABELS[p.category] || p.category || '—')}</td>
              <td>${p.sales}</td>
              <td>${p.totalToken}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  async function loadAnalyticsStatsOnly() {
    const statsEl = $('#analytics-stats');
    try {
      const { stats } = await api('/admin/stats');
      statsEl.innerHTML = renderStatBoxes(stats) + renderTopProductsTable(stats.topProducts);
    } catch (err) {
      statsEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  async function runAIAnalysis() {
    const btn = $('#run-analysis-btn');
    const statsEl = $('#analytics-stats');
    const insightsEl = $('#analytics-insights');

    btn.disabled = true;
    btn.innerHTML = 'AI đang phân tích<span class="loading-dots"></span>';
    insightsEl.innerHTML = '';

    try {
      const { stats, insights } = await api('/ai/analyze-sales', { method: 'POST' });
      statsEl.innerHTML = renderStatBoxes(stats) + renderTopProductsTable(stats.topProducts);

      insightsEl.innerHTML = `
        <div class="insight-block">
          <h4>Tổng quan</h4>
          <p>${escapeHtml(insights.summary || '')}</p>
        </div>
        <div class="insight-block">
          <h4>Điểm nổi bật</h4>
          ${renderList(insights.highlights, 'Chưa có điểm nổi bật nào.')}
        </div>
        <div class="insight-block">
          <h4>Nhận định sản phẩm bán chạy</h4>
          <p>${escapeHtml(insights.topProductAdvice || '')}</p>
        </div>
        <div class="insight-block">
          <h4>Gợi ý chiến lược giá</h4>
          <p>${escapeHtml(insights.pricingAdvice || '')}</p>
        </div>
        <div class="insight-block">
          <h4>⚠ Cảnh báo sắp hết hàng</h4>
          ${renderList(insights.restockAlerts, 'Không có sản phẩm nào sắp hết hàng.')}
        </div>
        <div class="insight-block">
          <h4>⚠ Cảnh báo rủi ro</h4>
          ${renderList(insights.riskWarnings, 'Không có rủi ro đáng chú ý.')}
        </div>`;
    } catch (err) {
      insightsEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Phân tích bằng AI (tuỳ chọn)';
    }
  }

  // =========================================================
  // CHAT WIDGET (demo don gian)
  // =========================================================
  function sendChatMessage() {
    const input = $('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    const body = $('#chat-body');
    body.insertAdjacentHTML('beforeend', `<div class="chat-msg me">${escapeHtml(text)}</div>`);
    input.value = '';
    body.scrollTop = body.scrollHeight;
    setTimeout(() => {
      body.insertAdjacentHTML('beforeend', `<div class="chat-msg them">Cảm ơn bạn! Đội ngũ hỗ trợ sẽ phản hồi sớm nhất có thể.</div>`);
      body.scrollTop = body.scrollHeight;
    }, 700);
  }

  // =========================================================
  // EVENT BINDINGS
  // =========================================================
  function bindEvents() {
    // Modal open/close
    $$('[data-close]').forEach((btn) => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
    $$('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
    });

    // Auth
    $('#login-nav-btn').addEventListener('click', () => openModal('auth-modal'));
    $('#logout-nav-btn').addEventListener('click', logout);
    $('#login-submit-btn').addEventListener('click', login);
    $('#register-submit-btn').addEventListener('click', register);
    $('#go-register-btn').addEventListener('click', () => {
      $('#login-view').classList.add('hidden');
      $('#register-view').classList.remove('hidden');
    });
    $('#go-login-btn').addEventListener('click', () => {
      $('#register-view').classList.add('hidden');
      $('#login-view').classList.remove('hidden');
    });

    // Hero
    $('#hero-explore-btn').addEventListener('click', () => {
      $('#shop-section').scrollIntoView({ behavior: 'smooth' });
    });
    $('#hero-recharge-btn').addEventListener('click', openRecharge);

    // Filters
    $$('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        $$('.filter-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state.category = chip.dataset.cat;
        loadProducts();
      });
    });
    let searchTimer;
    $('#search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value.trim();
        loadProducts();
      }, 350);
    });

    // Library / Admin
    $('#nav-library-link').addEventListener('click', openLibrary);
    $('#admin-btn').addEventListener('click', openAdmin);
    $('#pp-btn').addEventListener('click', manualPublish);
    $('#pp-images').addEventListener('change', previewPostImages);
    $('#admin-products-list').addEventListener('click', onAdminProductClick);
    $('#admin-users-list').addEventListener('click', onAdminUserClick);
    $('#pw-btn').addEventListener('click', changePassword);
    $('#music-add-btn').addEventListener('click', addMusic);
    $('#admin-music-list').addEventListener('click', onAdminMusicClick);

    // Admin tabs
    $$('.admin-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.admin-tabs button').forEach((b) => b.classList.remove('active'));
        $$('.admin-panel-section').forEach((s) => s.classList.remove('active'));
        btn.classList.add('active');
        $(`#admin-tab-${btn.dataset.tab}`).classList.add('active');
        if (btn.dataset.tab === 'music') loadAdminMusic();
        if (btn.dataset.tab === 'analytics' && !$('#analytics-stats').innerHTML.trim()) {
          loadAnalyticsStatsOnly();
        }
      });
    });
    $('#run-analysis-btn').addEventListener('click', runAIAnalysis);

    // Chat widget
    $('#chat-fab').addEventListener('click', () => $('#chat-window').classList.toggle('hidden'));
    $('#chat-send-btn').addEventListener('click', sendChatMessage);
    $('#chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChatMessage(); });

    // Enter-to-submit cho form dang nhap/dang ky
    $('#login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
    $('#register-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') register(); });
  }

  // =========================================================
  // NHAC NEN: random 1 bai tu kho nhac (link Catbox) khi vao web
  // =========================================================
  const music = { tracks: [], current: null, failed: new Set(), ready: false, unlocked: false };

  function loadMusicPrefs() {
    try { return JSON.parse(localStorage.getItem('tgg_music') || '{}'); } catch (e) { return {}; }
  }
  function saveMusicPrefs(patch) {
    try { localStorage.setItem('tgg_music', JSON.stringify({ ...loadMusicPrefs(), ...patch })); } catch (e) {}
  }

  function setMusicUI(playing) {
    $('#music-toggle').textContent = playing ? '⏸' : '▶';
    $('#music-eq').classList.toggle('playing', playing);
  }

  function pickRandomTrack() {
    let pool = music.tracks.filter((t) => !music.failed.has(t.url));
    if (pool.length > 1 && music.current) pool = pool.filter((t) => t.url !== music.current.url);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  function playRandomTrack() {
    const audio = $('#music-audio');
    const track = pickRandomTrack();
    if (!track) {
      $('#music-player').classList.add('hidden');
      return;
    }
    music.current = track;
    $('#music-title').textContent = track.title;
    audio.src = track.url;
    const p = audio.play();
    if (p && p.catch) {
      p.catch((err) => {
        // Trinh duyet chan tu phat -> cho nguoi dung cham vao trang lan dau
        if (err && err.name === 'NotAllowedError') {
          setMusicUI(false);
          $('#music-title').textContent = 'Chạm vào trang để bật nhạc';
        }
      });
    }
  }

  function unlockMusicOnFirstTouch() {
    const handler = (e) => {
      if (music.unlocked) return;
      if (e.target && e.target.closest && e.target.closest('#music-player')) return;
      music.unlocked = true;
      ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.removeEventListener(ev, handler));
      const audio = $('#music-audio');
      if (audio.paused && !loadMusicPrefs().userPaused) {
        if (music.current) $('#music-title').textContent = music.current.title;
        audio.play().catch(() => {});
      }
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, handler, { passive: true }));
  }

  async function initMusic() {
    let tracks = [];
    try {
      const data = await api('/music');
      tracks = data.tracks || [];
    } catch (e) { return; }
    music.tracks = tracks;
    music.failed.clear();
    if (!tracks.length) { $('#music-player').classList.add('hidden'); return; }
    if (music.ready) return; // da khoi dong player, chi cap nhat danh sach
    music.ready = true;

    const audio = $('#music-audio');
    const prefs = loadMusicPrefs();
    const vol = typeof prefs.volume === 'number' ? prefs.volume : 50;
    $('#music-volume').value = vol;
    audio.volume = vol / 100;

    audio.addEventListener('play', () => setMusicUI(true));
    audio.addEventListener('pause', () => setMusicUI(false));
    audio.addEventListener('ended', playRandomTrack);
    audio.addEventListener('error', () => {
      // Link chet / khong phai file am thanh -> bo qua, thu bai khac
      if (music.current) music.failed.add(music.current.url);
      playRandomTrack();
    });

    $('#music-toggle').addEventListener('click', () => {
      if (audio.paused) {
        saveMusicPrefs({ userPaused: false });
        if (!audio.src) playRandomTrack(); else audio.play().catch(() => {});
        if (music.current) $('#music-title').textContent = music.current.title;
      } else {
        saveMusicPrefs({ userPaused: true });
        audio.pause();
      }
    });
    $('#music-next').addEventListener('click', () => { saveMusicPrefs({ userPaused: false }); playRandomTrack(); });
    $('#music-volume').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      audio.volume = v / 100;
      saveMusicPrefs({ volume: v });
    });

    $('#music-player').classList.remove('hidden');
    if (!prefs.userPaused) {
      playRandomTrack();
      unlockMusicOnFirstTouch();
    } else {
      // Nguoi dung da tat nhac lan truoc: chi chon san 1 bai, khong tu phat
      const t = pickRandomTrack();
      if (t) { music.current = t; audio.src = t.url; $('#music-title').textContent = t.title; }
    }
  }

  // ---------- Admin: quan ly nhac ----------
  function parseMusicLines(text) {
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const idx = line.lastIndexOf('|');
      if (idx === -1) return { title: '', url: line };
      return { title: line.slice(0, idx).trim(), url: line.slice(idx + 1).trim() };
    });
  }

  async function loadAdminMusic() {
    const box = $('#admin-music-list');
    try {
      const { tracks } = await api('/admin/music');
      if (!tracks.length) { box.innerHTML = '<p style="color:var(--muted)">Chưa có bài nhạc nào.</p>'; return; }
      box.innerHTML = `
        <div style="overflow-x:auto"><table class="admin-table">
          <thead><tr><th>Tên bài</th><th>Link</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${tracks.map((t) => `
            <tr data-mid="${escapeAttr(t._id)}">
              <td>${escapeHtml(t.title)}</td>
              <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="${safeUrl(t.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.url)}</a></td>
              <td>${t.isActive ? 'Đang bật' : 'Đã tắt'}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-act="toggle" data-active="${t.isActive}">${t.isActive ? 'Tắt' : 'Bật'}</button>
                <button class="btn btn-ghost btn-sm" data-act="del">Xoá</button>
              </td>
            </tr>`).join('')}
          </tbody></table></div>`;
    } catch (err) {
      box.innerHTML = `<p style="color:var(--danger)">${escapeHtml(err.message)}</p>`;
    }
  }

  async function addMusic() {
    const tracks = parseMusicLines($('#music-input').value);
    if (!tracks.length) return toast('Hãy dán ít nhất 1 link nhạc.', 'error');
    if (!tracks.every((t) => /^https?:\/\//i.test(t.url))) return toast('Mỗi link phải bắt đầu bằng http:// hoặc https://', 'error');
    const btn = $('#music-add-btn');
    btn.disabled = true;
    try {
      const r = await api('/admin/music', { method: 'POST', body: JSON.stringify({ tracks }) });
      toast(r.message);
      $('#music-input').value = '';
      loadAdminMusic();
      initMusic();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function onAdminMusicClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.mid;
    try {
      if (btn.dataset.act === 'toggle') {
        await api(`/admin/music/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: btn.dataset.active !== 'true' }) });
      } else if (btn.dataset.act === 'del') {
        if (!confirm('Xoá bài nhạc này?')) return;
        await api(`/admin/music/${id}`, { method: 'DELETE' });
      }
      loadAdminMusic();
      initMusic();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // =========================================================
  // INIT
  // =========================================================
  document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    updateAuthUI();
    initMusic();
    await restoreSession();
    loadProducts();
  });
})();
