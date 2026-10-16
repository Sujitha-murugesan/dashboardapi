import { fetchProducts, friendlyMessage } from "./api.js";
import { loadCache, saveCache, loadPrefs, savePrefs, loadCart, saveCart } from "./storage.js";
import {
  SORTS, filterProducts, sortProducts, getCategories, categoryLabel, addToCart, setQuantity,
  removeFromCart, cartTotal, cartCount, formatPrice, debounce, formatAge,
} from "./logic.js";

const $ = (sel) => document.querySelector(sel);
const els = {
  search: $("#product-search"), sort: $("#product-sort"), tabs: $("#category-tabs"),
  status: $("#results-status"), region: $("#product-region"), banner: $("#banner"),
  cartBody: $("#cart-body"), cartStatus: $("#cart-status"), cartHeading: $("#cart-heading"),
};

const state = { products: [], status: "loading", prefs: loadPrefs(), cart: loadCart(), savedAt: null };
let loading = false;
let renderedCategories = "";

// Safe DOM builder: text is always set with textContent (never innerHTML), so API data cannot inject markup.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) node.append(c);
  return node;
}
const hiddenText = (t) => el("span", { class: "visually-hidden", text: t });
const PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#d0d5dd"/><text x="100" y="108" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#475467">No image</text></svg>');

// ---------- Banner ----------
function showBanner(kind, message, actions = []) {
  els.banner.replaceChildren(el("p", { text: message }), ...actions.map((a) => {
    const b = el("button", { type: "button", text: a.label });
    b.addEventListener("click", a.onClick);
    return b;
  }));
  els.banner.dataset.kind = kind;
  els.banner.hidden = false;
}
function hideBanner() { els.banner.hidden = true; els.banner.replaceChildren(); }

// ---------- Products ----------
function visibleProducts() {
  return sortProducts(filterProducts(state.products, state.prefs), state.prefs.sort);
}

function skeletonList() {
  const ul = el("ul", { class: "product-grid", "aria-hidden": "true" });
  for (let i = 0; i < 8; i++) {
    ul.append(el("li", { class: "skeleton-card" },
      el("div", { class: "skeleton skeleton-media" }),
      el("div", { class: "skeleton skeleton-line" }),
      el("div", { class: "skeleton skeleton-line short" }),
      el("div", { class: "skeleton skeleton-btn" })));
  }
  return ul;
}

function productCard(p) {
  const img = el("img", { src: p.image, alt: "", loading: "lazy", decoding: "async", width: 200, height: 200 });
  img.addEventListener("error", () => { img.src = PLACEHOLDER; }, { once: true });
  const rating = el("p", { class: "rating" },
    el("span", { "aria-hidden": "true", text: `★ ${p.rating.rate.toFixed(1)} ` }),
    el("span", { class: "muted", "aria-hidden": "true", text: `(${p.rating.count})` }),
    hiddenText(`Rated ${p.rating.rate.toFixed(1)} out of 5 from ${p.rating.count} reviews`));
  const btn = el("button", { type: "button", class: "primary", "data-add": p.id }, "Add to cart", hiddenText(`: ${p.title}`));
  return el("li", {},
    el("article", { class: "product-card", "aria-labelledby": `p-${p.id}` },
      el("div", { class: "product-media" }, img),
      el("p", { class: "badge", text: categoryLabel(p.category) }),
      el("h3", { id: `p-${p.id}`, class: "product-title", text: p.title }),
      rating,
      el("p", { class: "price", text: formatPrice(p.price) }),
      btn));
}

function renderProducts() {
  const busy = state.status === "loading";
  els.region.setAttribute("aria-busy", String(busy));
  if (busy) { els.region.replaceChildren(skeletonList()); els.status.textContent = "Loading products…"; return; }
  if (state.status === "error") { els.region.replaceChildren(); els.status.textContent = "Products are unavailable right now."; return; }

  const list = visibleProducts();
  els.status.textContent = `${list.length} product${list.length === 1 ? "" : "s"} found`;
  if (list.length === 0) {
    const clear = el("button", { type: "button", text: "Clear search and filters" });
    clear.addEventListener("click", () => {
      state.prefs = { query: "", category: "all", sort: "relevance" };
      els.search.value = ""; els.sort.value = "relevance";
      savePrefs(state.prefs); render(); els.search.focus();
    });
    els.region.replaceChildren(el("div", { class: "empty-state" }, el("p", { text: "No products match your search." }), clear));
    return;
  }
  const ul = el("ul", { class: "product-grid" });
  list.forEach((p) => ul.append(productCard(p)));
  els.region.replaceChildren(ul);
}

function renderTabs() {
  const cats = getCategories(state.products);
  const sig = cats.join("|");
  if (sig !== renderedCategories) {
    renderedCategories = sig;
    els.tabs.replaceChildren(...["all", ...cats].map((c) =>
      el("button", { type: "button", "data-category": c, "aria-pressed": "false", text: categoryLabel(c) })));
  }
  els.tabs.querySelectorAll("button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.category === state.prefs.category)));
}

// ---------- Cart ----------
function renderCart() {
  const active = document.activeElement;
  const focusKey = active && els.cartBody.contains(active) ? { a: active.dataset.cartAction, id: active.dataset.id } : null;

  if (state.cart.length === 0) {
    els.cartBody.replaceChildren(el("p", { class: "muted", text: "Your cart is empty. Add a product to get started." }));
  } else {
    const ul = el("ul", { class: "cart-list" });
    state.cart.forEach((i) => {
      const btn = (action, label, text) => el("button", { type: "button", "data-cart-action": action, "data-id": i.id, "aria-label": label, text });
      ul.append(el("li", { class: "cart-item" },
        el("p", { class: "cart-title", text: i.title }),
        el("p", { class: "muted", text: `${formatPrice(i.price)} each` }),
        el("div", { class: "qty" },
          btn("dec", `Decrease quantity of ${i.title}`, "−"),
          el("span", { class: "qty-value", text: String(i.qty), "aria-label": `Quantity ${i.qty}` }),
          btn("inc", `Increase quantity of ${i.title}`, "+"),
          el("button", { type: "button", class: "link-btn", "data-cart-action": "remove", "data-id": i.id }, "Remove", hiddenText(` ${i.title}`)))));
    });
    const clear = el("button", { type: "button", "data-cart-action": "clear", text: "Clear cart" });
    els.cartBody.replaceChildren(ul,
      el("p", { class: "cart-total" }, `Total (${cartCount(state.cart)} items): `, el("strong", { text: formatPrice(cartTotal(state.cart)) })),
      el("p", { class: "hint", text: "Demo cart saved in this browser only." }), clear);
  }
  if (focusKey) {
    const target = els.cartBody.querySelector(`[data-cart-action="${focusKey.a}"]${focusKey.id ? `[data-id="${focusKey.id}"]` : ""}`);
    (target || els.cartHeading).focus();
  }
}

function updateCart(next, announce) {
  state.cart = next;
  saveCart(next);
  renderCart();
  if (announce) els.cartStatus.textContent = announce;
}

// ---------- Rendering + events ----------
function render() { renderTabs(); renderProducts(); }

els.region.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  const p = state.products.find((x) => x.id === Number(btn.dataset.add));
  if (p) updateCart(addToCart(state.cart, p), `Added ${p.title} to cart. ${cartCount(addToCart(state.cart, p))} items in cart.`);
});

els.cartBody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cart-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const item = state.cart.find((i) => i.id === id);
  switch (btn.dataset.cartAction) {
    case "inc": return updateCart(setQuantity(state.cart, id, item.qty + 1));
    case "dec": return updateCart(setQuantity(state.cart, id, item.qty - 1), item.qty === 1 ? `Removed ${item.title} from cart.` : "");
    case "remove": return updateCart(removeFromCart(state.cart, id), `Removed ${item.title} from cart.`);
    case "clear": return updateCart([], "Cart cleared.");
  }
});

els.tabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-category]");
  if (!btn) return;
  state.prefs.category = btn.dataset.category;
  savePrefs(state.prefs); render();
});

els.search.addEventListener("input", debounce(() => {
  state.prefs.query = els.search.value;
  savePrefs(state.prefs); render();
}, 200));

els.sort.addEventListener("change", () => {
  state.prefs.sort = els.sort.value;
  savePrefs(state.prefs); render();
});

// ---------- Data loading ----------
async function load() {
  if (loading) return;
  loading = true;
  const cached = loadCache();
  if (cached) { state.products = cached.products; state.savedAt = cached.savedAt; state.status = "ready"; }
  else { state.products = []; state.status = "loading"; }
  hideBanner();
  render();

  try {
    const products = await fetchProducts();
    state.products = products; state.status = "ready"; state.savedAt = Date.now();
    saveCache(products);
  } catch (err) {
    const retry = [{ label: "Try again", onClick: load }];
    if (cached) {
      showBanner("warning", `${friendlyMessage(err)} Showing products saved ${formatAge(Date.now() - cached.savedAt)}.`, retry);
    } else {
      state.status = "error";
      showBanner("error", friendlyMessage(err), retry);
    }
  } finally {
    loading = false;
  }
  if (state.prefs.category !== "all" && !getCategories(state.products).includes(state.prefs.category)) {
    state.prefs.category = "all"; savePrefs(state.prefs);
  }
  render();
}

// ---------- Init ----------
els.search.value = state.prefs.query;
els.sort.value = SORTS.includes(state.prefs.sort) ? state.prefs.sort : "relevance";
renderCart();
load();
