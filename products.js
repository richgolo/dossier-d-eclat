// Renders the shop grid from the Supabase `products` table.
// She manages products entirely from Supabase's Table Editor — this script
// just fetches and displays whatever rows are there.

const CARD_BG_PALETTE = [
  '#F5EDE8', '#FDF0E8', '#FAF0F5', '#F5F0F8', '#F8F5F0',
  '#F0EAE6', '#FDF0F5', '#F0F5EE', '#F8F0E8', '#F0EBF0',
  '#F0F5F8', '#FBF5F8', '#F8F0F5'
];

const DEFAULT_FALLBACK_ICON = 'fa-solid fa-heart';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function productImagesHtml(images, name) {
  if (images.length === 0) return '';

  if (images.length === 1) {
    return `<img loading="lazy" src="${escapeHtml(images[0])}" alt="${escapeHtml(name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`;
  }

  const slides = images.map((url, i) =>
    `<img loading="lazy" class="product-img-slide${i === 0 ? ' active' : ''}" src="${escapeHtml(url)}" alt="${escapeHtml(name)}">`
  ).join('');

  const dots = images.map((_, i) =>
    `<button type="button" class="product-img-dot${i === 0 ? ' active' : ''}" onclick="event.stopPropagation();showProductImage(this,${i})" aria-label="Photo ${i + 1}"></button>`
  ).join('');

  return slides + `<div class="product-img-dots">${dots}</div>`;
}

function showProductImage(dotEl, index) {
  const container = dotEl.closest('.product-img');
  container.querySelectorAll('.product-img-slide').forEach((img, i) => img.classList.toggle('active', i === index));
  container.querySelectorAll('.product-img-dot').forEach((d, i) => d.classList.toggle('active', i === index));
}

function productCardHtml(product, index) {
  const bg = CARD_BG_PALETTE[index % CARD_BG_PALETTE.length];
  const soldOut = !product.in_stock;
  const images = [product.image_url, product.image_url_2, product.image_url_3].filter(Boolean);
  const hasImage = images.length > 0;

  const imgTag = productImagesHtml(images, product.name);

  const tagHtml = soldOut
    ? `<span class="product-tag sold-out">Sold Out</span>`
    : (product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : '');

  const icon = product.fallback_icon || DEFAULT_FALLBACK_ICON;
  const searchText = `${product.name} ${product.brand} ${product.description}`.toLowerCase();

  const variants = variantsByProduct[product.id] || [];
  const hasVariants = variants.length > 0;
  const variantHint = hasVariants
    ? `<p class="product-variant-hint">${variants.length} option${variants.length !== 1 ? 's' : ''} available</p>`
    : '';
  const footerBtn = hasVariants
    ? `<button class="product-btn choose-variant-btn"${soldOut ? ' disabled' : ''}>${soldOut ? 'Sold Out' : 'Select Options'}</button>`
    : `<button class="product-btn add-to-cart-btn"${soldOut ? ' disabled' : ''}>${soldOut ? 'Sold Out' : 'Add to Cart'}</button>`;

  return `
      <div class="product-card${soldOut ? ' sold-out' : ''}" data-cat="${escapeHtml(product.category)}" data-search="${escapeHtml(searchText)}" data-product-id="${escapeHtml(product.id)}">
        <div class="product-img" style="background:${bg}">
          ${imgTag}
          <div class="product-icon-fallback" style="display:${hasImage ? 'none' : 'flex'}" data-icon="${escapeHtml(icon)}"><i class="${escapeHtml(icon)}"></i></div>
          ${tagHtml}
        </div>
        <div class="product-body">
          <p class="product-brand">${escapeHtml(product.brand)}</p>
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
          <p class="product-desc">${escapeHtml(product.description)}</p>
          ${variantHint}
          <div class="product-footer">
            <span class="product-price">GHS ${product.price}</span>
            ${footerBtn}
          </div>
        </div>
      </div>`;
}

let productsCache = [];
let variantsByProduct = {};

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '<div class="products-loading">Loading the collection…</div>';

  if (!supabaseClient) {
    grid.innerHTML = '<div class="products-error">The shop isn\'t connected yet — fill in supabase-config.js.</div>';
    return;
  }

  let data, error;
  try {
    ({ data, error } = await supabaseClient.from('products').select('*').order('created_at'));
  } catch (e) {
    error = e;
  }

  if (error) {
    console.error('Failed to load products', error);
    grid.innerHTML = '<div class="products-error">Couldn\'t load the collection right now. Please refresh, or message us on WhatsApp.</div>';
    return;
  }

  const products = data || [];
  productsCache = products;

  let variantRows = [];
  try {
    ({ data: variantRows } = await supabaseClient.from('product_variants').select('*').order('id'));
  } catch (e) {
    console.error('Failed to load product variants', e);
  }
  variantsByProduct = {};
  (variantRows || []).forEach(v => {
    (variantsByProduct[v.product_id] = variantsByProduct[v.product_id] || []).push(v);
  });

  grid.innerHTML = products.map(productCardHtml).join('') + `
      <div class="empty-state" id="emptyState">
        <p>No products in this category yet. More coming soon.</p>
      </div>`;

  document.getElementById('productCount').textContent =
    products.length + ' product' + (products.length !== 1 ? 's' : '');

  // Auto-filter from URL param (e.g. shop.html?cat=gloss)
  const urlCat = new URLSearchParams(window.location.search).get('cat');
  if (urlCat) {
    const tab = [...document.querySelectorAll('.cat-tab')].find(t => t.getAttribute('onclick')?.includes("'" + urlCat + "'"));
    if (tab) filterCat(urlCat, tab);
  }
}

// ── QUICK VIEW ────────────────────────────────────────────
// Tapping a product card (anywhere but the Add to Cart/Select Options
// button or photo dots) opens a bigger-photo popup with the full
// description, and — for a product with shades/flavors — a picker to
// choose one before it can be added to the cart.

let currentQuickViewProduct = null;
let currentQuickViewVariants = [];
let selectedVariant = null;

function renderQuickViewMedia() {
  const product = currentQuickViewProduct;
  const soldOut = !product.in_stock;
  const icon = product.fallback_icon || DEFAULT_FALLBACK_ICON;

  // A shade with its own photo takes over the gallery; otherwise fall
  // back to the product's own photos.
  const images = (selectedVariant && selectedVariant.image_url)
    ? [selectedVariant.image_url]
    : [product.image_url, product.image_url_2, product.image_url_3].filter(Boolean);
  const hasImage = images.length > 0;

  document.getElementById('qvMedia').innerHTML = `
    ${productImagesHtml(images, product.name)}
    <div class="product-icon-fallback" style="display:${hasImage ? 'none' : 'flex'}" data-icon="${escapeHtml(icon)}"><i class="${escapeHtml(icon)}"></i></div>
    ${soldOut ? '<span class="product-tag sold-out">Sold Out</span>' : (product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : '')}
  `;
}

function renderQuickViewVariantPicker() {
  const container = document.getElementById('qvVariants');
  if (currentQuickViewVariants.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <p class="qv-variant-label">Shade: <strong>${escapeHtml(selectedVariant.label)}</strong>${!selectedVariant.in_stock ? ' (Sold Out)' : ''}</p>
    <div class="qv-variant-options">
      ${currentQuickViewVariants.map(v => `
        <button type="button" class="qv-variant-btn${v.id === selectedVariant.id ? ' active' : ''}${!v.in_stock ? ' out-of-stock' : ''}" data-variant-id="${v.id}" title="${escapeHtml(v.label)}${!v.in_stock ? ' (Sold Out)' : ''}">
          ${v.image_url ? `<img src="${escapeHtml(v.image_url)}" alt="${escapeHtml(v.label)}">` : `<span class="qv-variant-swatch-label">${escapeHtml(v.label.slice(0, 2))}</span>`}
        </button>
      `).join('')}
    </div>
  `;
}

function updateQvAddButton() {
  const btn = document.getElementById('qvAddBtn');
  const product = currentQuickViewProduct;
  const soldOut = !product.in_stock || (selectedVariant ? !selectedVariant.in_stock : false);
  btn.disabled = soldOut;
  btn.textContent = soldOut ? 'Sold Out' : 'Add to Cart';
  if (selectedVariant) {
    btn.dataset.id = product.id + '-' + selectedVariant.id;
    btn.dataset.variant = selectedVariant.label;
  } else {
    delete btn.dataset.id;
    delete btn.dataset.variant;
  }
}

function openQuickView(product) {
  currentQuickViewProduct = product;
  currentQuickViewVariants = variantsByProduct[product.id] || [];
  selectedVariant = currentQuickViewVariants[0] || null;

  renderQuickViewMedia();
  renderQuickViewVariantPicker();

  document.getElementById('qvBrand').textContent = product.brand;
  document.getElementById('qvName').textContent = product.name;
  document.getElementById('qvDesc').textContent = product.description;
  document.getElementById('qvPrice').textContent = 'GHS ' + product.price;

  updateQvAddButton();

  document.getElementById('quickViewOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeQuickView() {
  document.getElementById('quickViewOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('qvVariants').addEventListener('click', (e) => {
  const btn = e.target.closest('.qv-variant-btn');
  if (!btn) return;
  const variantId = Number(btn.dataset.variantId);
  selectedVariant = currentQuickViewVariants.find(v => v.id === variantId) || selectedVariant;
  renderQuickViewMedia();
  renderQuickViewVariantPicker();
  updateQvAddButton();
});

document.getElementById('productsGrid').addEventListener('click', (e) => {
  if (e.target.closest('.add-to-cart-btn') || e.target.closest('.product-img-dot')) return;
  const card = e.target.closest('.product-card');
  if (!card) return;
  const product = productsCache.find(p => String(p.id) === card.dataset.productId);
  if (product) openQuickView(product);
});

document.getElementById('qvAddBtn').addEventListener('click', () => closeQuickView());
document.getElementById('quickViewClose').addEventListener('click', closeQuickView);
document.getElementById('quickViewOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeQuickView();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeQuickView();
});

loadProducts();
