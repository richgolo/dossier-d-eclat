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

  return `
      <div class="product-card${soldOut ? ' sold-out' : ''}" data-cat="${escapeHtml(product.category)}" data-search="${escapeHtml(searchText)}">
        <div class="product-img" style="background:${bg}">
          ${imgTag}
          <div class="product-icon-fallback" style="display:${hasImage ? 'none' : 'flex'}" data-icon="${escapeHtml(icon)}"><i class="${escapeHtml(icon)}"></i></div>
          ${tagHtml}
        </div>
        <div class="product-body">
          <p class="product-brand">${escapeHtml(product.brand)}</p>
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
          <p class="product-desc">${escapeHtml(product.description)}</p>
          <div class="product-footer">
            <span class="product-price">GHS ${product.price}</span>
            <button class="product-btn add-to-cart-btn"${soldOut ? ' disabled' : ''}>${soldOut ? 'Sold Out' : 'Add to Cart'}</button>
          </div>
        </div>
      </div>`;
}

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

loadProducts();
