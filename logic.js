// Pure functions: no DOM, no network, easy to unit test.

export const SORTS = ["relevance", "price-asc", "price-desc", "rating-desc", "name-asc"];

export function categoryLabel(cat) {
  if (cat === "all") return "All";
  if (cat === "jewelery") return "Jewelry"; // the API spells it "jewelery"
  return cat.replace(/(^|\s)\w/g, (m) => m.toUpperCase());
}

export function getCategories(products) {
  return [...new Set(products.map((p) => p.category))].sort();
}

export function filterProducts(products, { query = "", category = "all" } = {}) {
  const q = query.trim().toLowerCase();
  return products.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (!q) return true;
    return [p.title, p.description, p.category].some((s) => String(s || "").toLowerCase().includes(q));
  });
}

export function sortProducts(products, key = "relevance") {
  const list = [...products];
  const rate = (p) => (p.rating && Number(p.rating.rate)) || 0;
  switch (key) {
    case "price-asc": return list.sort((a, b) => a.price - b.price);
    case "price-desc": return list.sort((a, b) => b.price - a.price);
    case "rating-desc": return list.sort((a, b) => rate(b) - rate(a));
    case "name-asc": return list.sort((a, b) => a.title.localeCompare(b.title));
    default: return list; // API order
  }
}

// ----- Cart (immutable updates; cart = [{ id, title, price, image, qty }]) -----
export function addToCart(cart, product) {
  const found = cart.find((i) => i.id === product.id);
  if (found) return cart.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
  return [...cart, { id: product.id, title: product.title, price: product.price, image: product.image, qty: 1 }];
}
export function setQuantity(cart, id, qty) {
  if (qty < 1) return removeFromCart(cart, id);
  return cart.map((i) => (i.id === id ? { ...i, qty: Math.min(qty, 99) } : i));
}
export function removeFromCart(cart, id) { return cart.filter((i) => i.id !== id); }
export function cartCount(cart) { return cart.reduce((n, i) => n + i.qty, 0); }
export function cartTotal(cart) {
  return Math.round(cart.reduce((sum, i) => sum + i.price * i.qty, 0) * 100) / 100;
}

// ----- Helpers -----
export function formatPrice(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
export function formatAge(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
