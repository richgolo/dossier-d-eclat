function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

class DossierCart {
  constructor() {
    this.items = [];
    this.phone = "233551411783";
    
    // Bind methods to keep context
    this.init = this.init.bind(this);
    this.addItem = this.addItem.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.updateQuantity = this.updateQuantity.bind(this);
    this.toggleDrawer = this.toggleDrawer.bind(this);
    this.render = this.render.bind(this);
    this.handleCheckout = this.handleCheckout.bind(this);
    
    // Wait for DOM to initialize
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.init);
    } else {
      this.init();
    }
  }

  init() {
    this.loadCart();
    this.setupEventListeners();
    this.render();
  }

  loadCart() {
    try {
      const stored = localStorage.getItem("dossier_cart");
      this.items = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Error reading cart from localStorage", e);
      this.items = [];
    }
  }

  saveCart() {
    try {
      localStorage.setItem("dossier_cart", JSON.stringify(this.items));
    } catch (e) {
      console.error("Error saving cart to localStorage", e);
    }
    this.render();
  }

  addItem(product) {
    const existing = this.items.find(item => item.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        brand: product.brand || "",
        price: parseFloat(product.price),
        img: product.img || "",
        fallbackIcon: product.fallbackIcon || "fa-solid fa-heart",
        quantity: 1
      });
    }
    this.saveCart();
    this.animateBadge();
    this.openDrawer();
  }

  removeItem(id) {
    this.items = this.items.filter(item => item.id !== id);
    this.saveCart();
  }

  updateQuantity(id, delta) {
    const item = this.items.find(item => item.id === id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeItem(id);
    } else {
      this.saveCart();
    }
  }

  getTotalPrice() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getTotalCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  animateBadge() {
    const badges = document.querySelectorAll("#cartBadge, #mobileCartBadge");
    badges.forEach(badge => {
      badge.classList.remove("pop");
      void badge.offsetWidth; // trigger reflow
      badge.classList.add("pop");
      setTimeout(() => badge.classList.remove("pop"), 300);
    });
  }

  toggleDrawer() {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");
    if (!drawer) return;
    
    const isOpen = drawer.classList.contains("open");
    if (isOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openDrawer() {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");
    if (drawer) drawer.classList.add("open");
    if (overlay) overlay.classList.add("open");
    document.body.style.overflow = "hidden"; // lock page scroll
  }

  closeDrawer() {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");
    if (drawer) drawer.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    document.body.style.overflow = ""; // unlock page scroll
  }

  setupEventListeners() {
    // Add to Cart buttons - using event delegation
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".add-to-cart-btn");
      if (btn) {
        e.preventDefault();
        const dataset = btn.dataset;
        
        // Extract product details
        const product = {
          id: dataset.id || btn.closest(".product-card")?.querySelector(".product-name")?.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-") || Math.random().toString(),
          name: dataset.name || btn.closest(".product-card")?.querySelector(".product-name")?.textContent || "Beauty Essential",
          brand: dataset.brand || btn.closest(".product-card")?.querySelector(".product-brand")?.textContent || "Dossier d'Éclat",
          price: dataset.price || btn.closest(".product-card")?.querySelector(".product-price")?.textContent.replace(/[^0-9.]/g, "") || "0",
          img: dataset.img || btn.closest(".product-card")?.querySelector(".product-img img")?.src || "",
          fallbackIcon: dataset.fallbackIcon || btn.closest(".product-card")?.querySelector(".product-icon-fallback")?.dataset.icon || "fa-solid fa-heart"
        };

        this.addItem(product);

        // Animate button feedback
        const originalText = btn.innerHTML;
        btn.classList.add("added");
        btn.innerHTML = "Added! <i class=\"fa-solid fa-check\"></i>";
        setTimeout(() => {
          btn.classList.remove("added");
          btn.innerHTML = originalText;
        }, 1500);
      }
    });

    // Drawer Toggles
    const toggleBtns = document.querySelectorAll("#cartToggleBtn, #mobileCartToggle");
    toggleBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggleDrawer();
      });
    });

    // Close Button
    const closeBtn = document.getElementById("cartClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeDrawer());
    }

    // Backdrop Click
    const overlay = document.getElementById("cartOverlay");
    if (overlay) {
      overlay.addEventListener("click", () => this.closeDrawer());
    }

    // Escape Key Dismissal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeDrawer();
      }
    });

    // Checkout Button
    const checkoutBtn = document.getElementById("cartCheckoutBtn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", this.handleCheckout);
    }
  }

  async handleCheckout() {
    if (this.items.length === 0) return;

    this.logOrder();

    let text = "Hi Dossier d'Éclat!\n\nI'd like to place an order:\n\n";
    text += "*Order Details:*\n";

    this.items.forEach(item => {
      const itemSubtotal = item.price * item.quantity;
      text += `• ${item.quantity}x ${item.name} (${item.brand}) - GHS ${itemSubtotal}\n`;
    });

    text += `\n*Total Amount:* GHS ${this.getTotalPrice()}\n\n`;
    text += "Please let me know how to proceed with payment and delivery details. Thank you!";

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${this.phone}?text=${encodedText}`;

    window.open(whatsappUrl, "_blank");
  }

  async logOrder() {
    // Best-effort sales log for the admin panel's Orders tab. Never blocks
    // or delays checkout — WhatsApp opens regardless of whether this
    // succeeds.
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    try {
      const items = this.items.map(item => ({
        name: item.name,
        brand: item.brand,
        price: item.price,
        quantity: item.quantity
      }));
      await supabaseClient.from("orders").insert({ items, total: this.getTotalPrice() });
    } catch (e) {
      console.warn("Could not log order", e);
    }
  }

  render() {
    // 1. Update Badge numbers
    const totalCount = this.getTotalCount();
    const badges = document.querySelectorAll("#cartBadge, #mobileCartBadge");
    badges.forEach(badge => {
      badge.textContent = totalCount;
      // Show/hide count if count is 0 vs >0
      if (badge.id === "cartBadge") {
        badge.style.display = totalCount > 0 ? "flex" : "none";
      } else {
        badge.textContent = `(${totalCount})`;
      }
    });

    // 2. Render items in drawer
    const container = document.getElementById("cartItems");
    if (!container) return;

    if (this.items.length === 0) {
      // Render Empty State
      container.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon"><i class="fa-solid fa-bag-shopping"></i></div>
          <p class="cart-empty-title">Your Cart is Empty</p>
          <p class="cart-empty-text">Add some beauty essentials to start glowing and complete your routine.</p>
          <a href="shop.html" class="cart-empty-shop-btn" id="cartEmptyShopBtn">Shop the Collection</a>
        </div>
      `;
      
      // Close cart if we clicked "Shop the Collection"
      const emptyShopBtn = document.getElementById("cartEmptyShopBtn");
      if (emptyShopBtn) {
        emptyShopBtn.addEventListener("click", () => this.closeDrawer());
      }
      
      // Disable checkout button
      const checkoutBtn = document.getElementById("cartCheckoutBtn");
      if (checkoutBtn) {
        checkoutBtn.style.opacity = "0.5";
        checkoutBtn.style.pointerEvents = "none";
      }
    } else {
      // Enable checkout button
      const checkoutBtn = document.getElementById("cartCheckoutBtn");
      if (checkoutBtn) {
        checkoutBtn.style.opacity = "1";
        checkoutBtn.style.pointerEvents = "auto";
      }

      // Render Item List
      let html = "";
      this.items.forEach(item => {
        const itemSubtotal = item.price * item.quantity;
        const imgTag = item.img
          ? `<img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" class="cart-item-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : "";

        html += `
          <div class="cart-item" data-item-id="${escapeHtml(item.id)}">
            <div class="cart-item-img-container">
              ${imgTag}
              <div class="cart-item-fallback-icon" style="${item.img ? 'display:none' : 'display:flex'}"><i class="${escapeHtml(item.fallbackIcon)}"></i></div>
            </div>
            <div class="cart-item-details">
              <span class="cart-item-brand">${escapeHtml(item.brand)}</span>
              <span class="cart-item-name">${escapeHtml(item.name)}</span>
              <span class="cart-item-price-unit">GHS ${item.price} each</span>
              <div class="cart-item-qty">
                <button class="qty-btn minus" data-id="${escapeHtml(item.id)}">-</button>
                <span class="qty-num">${item.quantity}</span>
                <button class="qty-btn plus" data-id="${escapeHtml(item.id)}">+</button>
              </div>
            </div>
            <div class="cart-item-right">
              <button class="cart-item-remove" data-id="${escapeHtml(item.id)}" aria-label="Remove item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
              <span class="cart-item-total">GHS ${itemSubtotal}</span>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;

      // Attach event listeners to render-created buttons
      container.querySelectorAll(".qty-btn.plus").forEach(btn => {
        btn.addEventListener("click", () => this.updateQuantity(btn.dataset.id, 1));
      });
      container.querySelectorAll(".qty-btn.minus").forEach(btn => {
        btn.addEventListener("click", () => this.updateQuantity(btn.dataset.id, -1));
      });
      container.querySelectorAll(".cart-item-remove").forEach(btn => {
        btn.addEventListener("click", () => this.removeItem(btn.dataset.id));
      });
    }

    // 3. Update total price
    const totalPriceEl = document.getElementById("cartTotalPrice");
    if (totalPriceEl) {
      totalPriceEl.textContent = `GHS ${this.getTotalPrice()}`;
    }
  }
}

// Instantiate the cart
const eclatCart = new DossierCart();
window.eclatCart = eclatCart; // Expose globally
