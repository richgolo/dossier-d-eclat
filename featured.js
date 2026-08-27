// Renders the homepage's "Browse by Category" preview section from
// products flagged Featured in the admin panel (up to 3). Hidden entirely
// if none are flagged yet.

const CATEGORY_LABELS = {
  gloss: 'Lip Glosses', liner: 'Lip Liners', balm: 'Lip Balms',
  brow: 'Brows', fragrance: 'Fragrance', wipes: 'Wipes & Care'
};

const PREVIEW_BG_PALETTE = ['#FDF0F3', '#F5F0F8', '#F5F0E8'];

function escapeHtmlFeatured(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function previewCardHtml(product, index) {
  const bg = PREVIEW_BG_PALETTE[index % PREVIEW_BG_PALETTE.length];
  const categoryLabel = CATEGORY_LABELS[product.category] || product.category;
  const imgTag = product.image_url
    ? `<img src="${escapeHtmlFeatured(product.image_url)}" alt="${escapeHtmlFeatured(product.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform 0.4s" onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform='scale(1)'">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;color:var(--pink-deep)"><i class="${escapeHtmlFeatured(product.fallback_icon || 'fa-solid fa-heart')}"></i></div>`;

  return `
    <a href="shop.html?cat=${encodeURIComponent(product.category)}" class="preview-card">
      <div class="preview-img" style="background:${bg}">${imgTag}</div>
      <div class="preview-label">
        <p class="preview-cat">${escapeHtmlFeatured(categoryLabel)}</p>
        <p class="preview-name">${escapeHtmlFeatured(product.name)}</p>
        <p class="preview-sub">${escapeHtmlFeatured(product.brand)}</p>
        <span class="preview-arrow">Shop ${escapeHtmlFeatured(categoryLabel)} →</span>
      </div>
    </a>`;
}

async function loadFeatured() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

  const section = document.getElementById('shopPreviewSection');
  const grid = document.getElementById('previewGrid');
  if (!section || !grid) return;

  let data, error;
  try {
    ({ data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('featured', true)
      .order('created_at')
      .limit(3));
  } catch (e) {
    error = e;
  }

  if (error || !data || data.length === 0) {
    if (error) console.error('Failed to load featured products', error);
    return; // section stays hidden
  }

  grid.innerHTML = data.map(previewCardHtml).join('');
  section.style.display = '';

  // A plain fade-in rather than a scroll-triggered one — this section's
  // content only exists once this fetch resolves, often well after the
  // page's other ScrollTrigger reveals were already set up, so a
  // ScrollTrigger created now could measure a stale position for it.
  if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.from(section, { opacity: 0, y: 30, duration: 0.9, ease: 'power2.out' });
  }
}

loadFeatured();
