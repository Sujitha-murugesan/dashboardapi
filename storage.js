// Safe localStorage wrapper: survives blocked storage, quota errors and corrupted JSON.
const memory = new Map();
export const CACHE_TTL_MS = 10 * 60 * 1000;
const KEYS = { cache: "shop:cache:v1", prefs: "shop:prefs:v1", cart: "shop:cart:v1" };

function read(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // Storage itself is unavailable (blocked): use the in-memory mirror.
    return memory.has(key) ? memory.get(key) : null;
  }
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; } // corrupted JSON: treat as empty
}
function write(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota or blocked: memory fallback */ }
}

// ----- Products cache -----
export function loadCache() {
  const c = read(KEYS.cache);
  if (!c || !Array.isArray(c.products) || typeof c.savedAt !== "number" || c.products.length === 0) return null;
  return c;
}
export function saveCache(products) { write(KEYS.cache, { savedAt: Date.now(), products }); }
export function isFresh(cache) { return Date.now() - cache.savedAt < CACHE_TTL_MS; }

// ----- User preferences -----
const DEFAULT_PREFS = { query: "", category: "all", sort: "relevance" };
export function loadPrefs() {
  const p = read(KEYS.prefs);
  if (!p || typeof p !== "object") return { ...DEFAULT_PREFS };
  return {
    query: typeof p.query === "string" ? p.query.slice(0, 100) : "",
    category: typeof p.category === "string" ? p.category : "all",
    sort: typeof p.sort === "string" ? p.sort : "relevance",
  };
}
export function savePrefs(prefs) { write(KEYS.prefs, prefs); }

// ----- Cart -----
export function loadCart() {
  const c = read(KEYS.cart);
  if (!Array.isArray(c)) return [];
  return c.filter((i) => i && Number.isFinite(i.id) && typeof i.title === "string"
    && Number.isFinite(i.price) && Number.isInteger(i.qty) && i.qty >= 1)
    .map((i) => ({ id: i.id, title: i.title, price: i.price, image: typeof i.image === "string" ? i.image : "", qty: Math.min(i.qty, 99) }));
}
export function saveCart(cart) {
  write(KEYS.cart, cart);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart:change"));
}
