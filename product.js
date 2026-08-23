// Renders a single product's detail page from the `products` table (plus
// its optional shades/flavors from `product_variants`), read from the
// ?id= URL param. Reached by tapping a product card on shop.html.

const DEFAULT_FALLBACK_ICON = 'fa-solid fa-heart';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

let currentProduct = null;
let currentVariants = [];
let selectedVariant = null;
let activeImageIndex = 0;

function galleryImages() {
  if (selectedVariant && selectedVariant.image_url) return [selectedVariant.image_url];
  return [currentProduct.image_url, currentProduct.image_url_2, currentProduct.image_url_3].filter(Boolean);
}

function renderGallery() {
  const images = galleryImages();
  if (activeImageIndex >= images.length) activeImageIndex = 0;
  const hasImage = images.length > 0;
  const icon = currentProduct.fallback_icon || DEFAULT_FALLBACK_ICON;
  const soldOut = !currentProduct.in_stock;

  document.getElementById('pdMainImg').innerHTML = `
    ${hasImage ? `<img src="${escapeHtml(images[activeImageIndex])}" alt="${escapeHtml(currentProduct.name)}">` : ''}
    <div class="product-icon-fallback" style="display:${hasImage ? 'none' : 'flex'}" data-icon="${escapeHtml(icon)}"><i class="${escapeHtml(icon)}"></i></div>
    ${soldOut ? '<span class="product-tag sold-out">Sold Out</span>' : (currentProduct.tag ? `<span class="product-tag">${escapeHtml(currentProduct.tag)}</span>` : '')}
  `;

  document.getElementById('pdThumbs').innerHTML = images.length > 1
    ? images.map((url, i) => `
        <button type="button" class="pd-thumb${i === activeImageIndex ? ' active' : ''}" data-index="${i}" aria-label="Photo ${i + 1}">
          <img src="${escapeHtml(url)}" alt="">
        </button>`).join('')
    : '';
}

function renderVariantPicker() {
  const container = document.getElementById('pdVariants');
  if (currentVariants.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <p class="qv-variant-label">Shade: <strong>${escapeHtml(selectedVariant.label)}</strong>${!selectedVariant.in_stock ? ' (Sold Out)' : ''}</p>
    <div class="qv-variant-options">
      ${currentVariants.map(v => `
        <button type="button" class="qv-variant-btn${v.id === selectedVariant.id ? ' active' : ''}${!v.in_stock ? ' out-of-stock' : ''}" data-variant-id="${v.id}" title="${escapeHtml(v.label)}${!v.in_stock ? ' (Sold Out)' : ''}">
          ${v.image_url ? `<img src="${escapeHtml(v.image_url)}" alt="${escapeHtml(v.label)}">` : `<span class="qv-variant-swatch-label">${escapeHtml(v.label.slice(0, 2))}</span>`}
        </button>`).join('')}
    </div>
  `;
}

function updateAddButton() {
  const btn = document.getElementById('pdAddBtn');
  const soldOut = !currentProduct.in_stock || (selectedVariant ? !selectedVariant.in_stock : false);
  btn.disabled = soldOut;
  btn.textContent = soldOut ? 'Sold Out' : 'Add to Cart';
  if (selectedVariant) {
    btn.dataset.id = currentProduct.id + '-' + selectedVariant.id;
    btn.dataset.variant = selectedVariant.label;
  } else {
    delete btn.dataset.id;
    delete btn.dataset.variant;
  }
}

function render() {
  document.title = currentProduct.name + " — Dossier d'Éclat";
  activeImageIndex = 0;
  renderGallery();
  renderVariantPicker();
  document.getElementById('pdBrand').textContent = currentProduct.brand;
  document.getElementById('pdName').textContent = currentProduct.name;
  document.getElementById('pdDesc').textContent = currentProduct.description;
  document.getElementById('pdPrice').textContent = 'GHS ' + currentProduct.price;
  updateAddButton();
}

document.getElementById('pdThumbs').addEventListener('click', (e) => {
  const btn = e.target.closest('.pd-thumb');
  if (!btn) return;
  activeImageIndex = Number(btn.dataset.index);
  renderGallery();
});

document.getElementById('pdVariants').addEventListener('click', (e) => {
  const btn = e.target.closest('.qv-variant-btn');
  if (!btn) return;
  const variantId = Number(btn.dataset.variantId);
  selectedVariant = currentVariants.find(v => v.id === variantId) || selectedVariant;
  activeImageIndex = 0;
  renderGallery();
  renderVariantPicker();
  updateAddButton();
});

async function loadProduct() {
  const loadingEl = document.getElementById('pdLoading');
  const errorEl = document.getElementById('pdError');
  const layoutEl = document.getElementById('pdLayout');
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id || !supabaseClient) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  let data, error;
  try {
    ({ data, error } = await supabaseClient.from('products').select('*').eq('id', id).single());
  } catch (e) {
    error = e;
  }

  if (error || !data) {
    console.error('Failed to load product', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    return;
  }

  currentProduct = data;

  let variantRows = [];
  try {
    const { data: vData } = await supabaseClient.from('product_variants').select('*').eq('product_id', id).order('id');
    variantRows = vData || [];
  } catch (e) {
    console.error('Failed to load product variants', e);
  }
  currentVariants = variantRows;
  selectedVariant = currentVariants[0] || null;

  render();

  loadingEl.style.display = 'none';
  layoutEl.style.display = 'grid';
}

loadProduct();
