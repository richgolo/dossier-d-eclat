// Admin panel logic: login, product CRUD (with photo upload), review moderation.
// Everything here is only reachable/usable by a logged-in Supabase user —
// see supabase-schema-update.sql for the RLS policies that actually enforce
// that server-side.

const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');

let editingProductId = null;
let editingProductImageUrl = null;

const DEFAULT_FALLBACK_ICON = 'fa-solid fa-heart';

// ── AUTH ──────────────────────────────────────────────────

async function checkSession() {
  if (!supabaseClient) {
    document.getElementById('loginError').textContent = "Not connected yet — fill in supabase-config.js.";
    document.getElementById('loginError').style.display = 'block';
    return;
  }
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showAdmin(session);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.style.display = 'flex';
  adminView.style.display = 'none';
}

function showAdmin(session) {
  loginView.style.display = 'none';
  adminView.style.display = 'block';
  document.getElementById('whoLabel').textContent = session.user.email;
  loadProducts();
  loadReviews();
  loadOrders();
  loadOverview();
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.style.display = 'none';

  if (!supabaseClient) {
    errorEl.textContent = "Not connected yet — fill in supabase-config.js.";
    errorEl.style.display = 'block';
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    errorEl.textContent = 'Wrong email or password.';
    errorEl.style.display = 'block';
    return;
  }
  showAdmin(data.session);
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

// ── TABS ──────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

function goToTab(name) {
  document.querySelector(`.tab-btn[data-tab="${name}"]`)?.click();
}

// ── OVERVIEW ──────────────────────────────────────────────

async function loadOverview() {
  const [productsRes, reviewsRes, ordersRes] = await Promise.all([
    supabaseClient.from('products').select('in_stock'),
    supabaseClient.from('reviews').select('approved'),
    supabaseClient.from('orders').select('status, total')
  ]);

  const products = productsRes.data || [];
  const reviews = reviewsRes.data || [];
  const orders = ordersRes.data || [];

  const soldOutCount = products.filter(p => !p.in_stock).length;
  const pendingReviewsCount = reviews.filter(r => !r.approved).length;
  const newOrdersCount = orders.filter(o => o.status === 'new').length;
  // Only "Completed" orders are counted as real revenue — "New" just means
  // someone clicked checkout, not that the sale actually went through.
  const revenue = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + Number(o.total), 0);

  document.getElementById('statSoldOut').textContent = soldOutCount;
  document.getElementById('statPendingReviews').textContent = pendingReviewsCount;
  document.getElementById('statNewOrders').textContent = newOrdersCount;
  document.getElementById('statRevenue').textContent = 'GHS ' + revenue.toFixed(2);
}

// ── PRODUCTS ──────────────────────────────────────────────

const CATEGORY_LABELS = {
  gloss: 'Lip Glosses', liner: 'Lip Liners', balm: 'Lip Balms',
  brow: 'Brows', fragrance: 'Fragrance', wipes: 'Wipes & Care'
};

let productsCache = [];

async function loadProducts() {
  const list = document.getElementById('productsList');
  const { data, error } = await supabaseClient.from('products').select('*').order('created_at');

  if (error) {
    list.innerHTML = `<p class="empty-msg">Couldn't load products: ${error.message}</p>`;
    return;
  }

  productsCache = data || [];

  if (productsCache.length === 0) {
    list.innerHTML = '<p class="empty-msg">No products yet.</p>';
    return;
  }

  list.innerHTML = productsCache.map(p => `
    <div class="row-card">
      <div class="row-thumb">
        ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="">` : `<i class="${escapeHtml(p.fallback_icon || DEFAULT_FALLBACK_ICON)}"></i>`}
      </div>
      <div class="row-info">
        <div class="name">${escapeHtml(p.name)}${!p.in_stock ? '<span class="sold-out-pill">Sold Out</span>' : ''}${p.featured ? '<span class="featured-pill">Featured</span>' : ''}</div>
        <div class="meta">${escapeHtml(p.brand)} · ${CATEGORY_LABELS[p.category] || p.category} · GHS ${p.price}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-outline btn-small" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn btn-danger btn-small" onclick="deleteProduct(${p.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function openProductForm(product) {
  editingProductId = product ? product.id : null;
  editingProductImageUrl = product ? product.image_url : null;

  document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('pfName').value = product ? product.name : '';
  document.getElementById('pfBrand').value = product ? product.brand : '';
  document.getElementById('pfCategory').value = product ? product.category : 'gloss';
  document.getElementById('pfPrice').value = product ? product.price : '';
  document.getElementById('pfDescription').value = product ? product.description : '';
  document.getElementById('pfTag').value = product ? (product.tag || '') : '';
  document.getElementById('pfFallbackIcon').value = product ? (product.fallback_icon || DEFAULT_FALLBACK_ICON) : DEFAULT_FALLBACK_ICON;
  document.getElementById('pfInStock').checked = product ? product.in_stock : true;
  document.getElementById('pfFeatured').checked = product ? Boolean(product.featured) : false;
  document.getElementById('pfPhoto').value = '';
  document.getElementById('productFormError').style.display = 'none';

  const preview = document.getElementById('currentPhotoPreview');
  if (product && product.image_url) {
    preview.src = product.image_url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  document.getElementById('productModal').classList.add('open');
}

function editProduct(id) {
  const product = productsCache.find(p => p.id === id);
  if (product) openProductForm(product);
}

document.getElementById('addProductBtn').addEventListener('click', () => openProductForm(null));
document.getElementById('cancelProductBtn').addEventListener('click', () => {
  document.getElementById('productModal').classList.remove('open');
});

document.getElementById('saveProductBtn').addEventListener('click', async () => {
  const errorEl = document.getElementById('productFormError');
  errorEl.style.display = 'none';

  const name = document.getElementById('pfName').value.trim();
  const brand = document.getElementById('pfBrand').value.trim();
  const category = document.getElementById('pfCategory').value;
  const price = parseFloat(document.getElementById('pfPrice').value);
  const description = document.getElementById('pfDescription').value.trim();
  const tag = document.getElementById('pfTag').value.trim() || null;
  const fallback_icon = document.getElementById('pfFallbackIcon').value || DEFAULT_FALLBACK_ICON;
  const in_stock = document.getElementById('pfInStock').checked;
  const featured = document.getElementById('pfFeatured').checked;
  const file = document.getElementById('pfPhoto').files[0];

  if (!name || !brand || isNaN(price)) {
    errorEl.textContent = 'Name, brand, and a valid price are required.';
    errorEl.style.display = 'block';
    return;
  }

  const saveBtn = document.getElementById('saveProductBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  let image_url = editingProductImageUrl;

  if (file) {
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { error: uploadError } = await supabaseClient.storage.from('product-photos').upload(path, file);
    if (uploadError) {
      errorEl.textContent = 'Photo upload failed: ' + uploadError.message;
      errorEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      return;
    }
    image_url = supabaseClient.storage.from('product-photos').getPublicUrl(path).data.publicUrl;
  }

  const row = { name, brand, category, price, description, tag, fallback_icon, in_stock, featured, image_url };

  const { error } = editingProductId
    ? await supabaseClient.from('products').update(row).eq('id', editingProductId)
    : await supabaseClient.from('products').insert(row);

  saveBtn.disabled = false;
  saveBtn.textContent = 'Save';

  if (error) {
    errorEl.textContent = 'Could not save: ' + error.message;
    errorEl.style.display = 'block';
    return;
  }

  document.getElementById('productModal').classList.remove('open');
  loadProducts();
});

function deleteProduct(id) {
  showConfirm('Delete this product? This cannot be undone.', async () => {
    const { error } = await supabaseClient.from('products').delete().eq('id', id);
    if (error) {
      showToast('Could not delete: ' + error.message, true);
      return;
    }
    showToast('Product deleted.');
    loadProducts();
  });
}

// ── REVIEWS ───────────────────────────────────────────────

async function loadReviews() {
  const { data, error } = await supabaseClient.from('reviews').select('*').order('created_at', { ascending: false });

  const pendingList = document.getElementById('pendingReviewsList');
  const approvedList = document.getElementById('approvedReviewsList');

  if (error) {
    pendingList.innerHTML = `<p class="empty-msg">Couldn't load reviews: ${error.message}</p>`;
    approvedList.innerHTML = '';
    return;
  }

  const reviews = data || [];
  const pending = reviews.filter(r => !r.approved);
  const approved = reviews.filter(r => r.approved);

  pendingList.innerHTML = pending.length
    ? pending.map(reviewRowHtml).join('')
    : '<p class="empty-msg">No pending reviews.</p>';

  approvedList.innerHTML = approved.length
    ? approved.map(reviewRowHtml).join('')
    : '<p class="empty-msg">No approved reviews yet.</p>';
}

function reviewRowHtml(r) {
  return `
    <div class="row-card">
      <div class="row-info">
        <div class="name">${escapeHtml(r.name)} <span class="review-stars">${'<i class="fa-solid fa-star"></i>'.repeat(r.stars)}${'<i class="fa-regular fa-star"></i>'.repeat(5 - r.stars)}</span></div>
        <div class="meta">${escapeHtml(r.text)}</div>
      </div>
      <div class="row-actions">
        ${!r.approved ? `<button class="btn btn-small" onclick="approveReview(${r.id})">Approve</button>` : ''}
        <button class="btn btn-danger btn-small" onclick="deleteReview(${r.id})">Delete</button>
      </div>
    </div>
  `;
}

async function approveReview(id) {
  const { error } = await supabaseClient.from('reviews').update({ approved: true }).eq('id', id);
  if (error) { showToast('Could not approve: ' + error.message, true); return; }
  showToast('Review approved.');
  loadReviews();
}

function deleteReview(id) {
  showConfirm('Delete this review?', async () => {
    const { error } = await supabaseClient.from('reviews').delete().eq('id', id);
    if (error) { showToast('Could not delete: ' + error.message, true); return; }
    showToast('Review deleted.');
    loadReviews();
  });
}

// ── ORDERS ────────────────────────────────────────────────
// No customer identity is stored here — this is just a sales log written
// automatically the moment someone clicks "Checkout via WhatsApp" (see
// cart.js's logOrder()). That's a checkout *attempt*, not a confirmed sale
// — she still needs to check the actual WhatsApp chat and mark each order
// Completed (money + delivery sorted) or Cancelled (never went through).

async function loadOrders() {
  const statEl = document.getElementById('ordersStat');
  const listEl = document.getElementById('ordersList');
  const { data, error } = await supabaseClient.from('orders').select('*').order('created_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<p class="empty-msg">Couldn't load orders: ${error.message}</p>`;
    statEl.textContent = '';
    return;
  }

  const orders = data || [];
  const revenue = orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + Number(o.total), 0);
  statEl.textContent = `${orders.length} order${orders.length !== 1 ? 's' : ''} logged · GHS ${revenue.toFixed(2)} confirmed revenue`;

  listEl.innerHTML = orders.length
    ? orders.map(orderRowHtml).join('')
    : '<p class="empty-msg">No orders yet.</p>';
}

function orderRowHtml(o) {
  const itemsSummary = (o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
  const date = new Date(o.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `
    <div class="row-card">
      <div class="row-info">
        <div class="name">GHS ${o.total}</div>
        <div class="meta">${date}</div>
        <div class="order-items">${escapeHtml(itemsSummary)}</div>
      </div>
      <div class="row-actions">
        <select class="order-status-select" onchange="updateOrderStatus(${o.id}, this.value)">
          <option value="new" ${o.status === 'new' ? 'selected' : ''}>New</option>
          <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
        <button class="btn btn-danger btn-small" onclick="deleteOrder(${o.id})">Delete</button>
      </div>
    </div>
  `;
}

async function updateOrderStatus(id, status) {
  const { error } = await supabaseClient.from('orders').update({ status }).eq('id', id);
  if (error) { showToast('Could not update: ' + error.message, true); return; }
  showToast('Order updated.');
  loadOrders();
}

function deleteOrder(id) {
  showConfirm('Delete this order record?', async () => {
    const { error } = await supabaseClient.from('orders').delete().eq('id', id);
    if (error) { showToast('Could not delete: ' + error.message, true); return; }
    showToast('Order deleted.');
    loadOrders();
  });
}

// ── HELPERS ───────────────────────────────────────────────

let confirmCallback = null;

function showConfirm(message, onConfirm) {
  document.getElementById('confirmModalText').textContent = message;
  confirmCallback = onConfirm;
  document.getElementById('confirmModal').classList.add('open');
}

document.getElementById('confirmModalYes').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.remove('open');
  const cb = confirmCallback;
  confirmCallback = null;
  if (cb) cb();
});

document.getElementById('confirmModalNo').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.remove('open');
  confirmCallback = null;
});

let toastTimer = null;

function showToast(message, isError) {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.className = 'toast open' + (isError ? ' toast-error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('open'), 4000);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

checkSession();
