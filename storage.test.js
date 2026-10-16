import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

function installStorage(impl) { globalThis.localStorage = impl; }
const makeStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; };

const storage = await import("../js/storage.js");

beforeEach(() => installStorage(makeStore()));

test("cart round-trips through localStorage", () => {
  storage.saveCart([{ id: 1, title: "A", price: 2.5, image: "", qty: 2 }]);
  assert.deepEqual(storage.loadCart(), [{ id: 1, title: "A", price: 2.5, image: "", qty: 2 }]);
});

test("corrupted JSON falls back to defaults", () => {
  const s = makeStore(); s.setItem("shop:cart:v1", "{bad json"); s.setItem("shop:prefs:v1", "nope");
  installStorage(s);
  assert.deepEqual(storage.loadPrefs(), { query: "", category: "all", sort: "relevance" });
  assert.deepEqual(storage.loadCart(), []);
});

test("invalid cart rows are dropped", () => {
  const s = makeStore(); s.setItem("shop:cart:v1", JSON.stringify([{ id: 1, title: "ok", price: 1, qty: 1 }, { id: "x" }, { id: 2, title: "neg", price: 1, qty: -3 }]));
  installStorage(s);
  assert.equal(storage.loadCart().length, 1);
});

test("blocked storage still works in memory", () => {
  installStorage({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
  storage.savePrefs({ query: "x", category: "all", sort: "price-asc" });
  assert.equal(storage.loadPrefs().sort, "price-asc");
});

test("products cache: fresh vs stale", () => {
  storage.saveCache([{ id: 1 }]);
  const c = storage.loadCache();
  assert.equal(storage.isFresh(c), true);
  assert.equal(storage.isFresh({ ...c, savedAt: Date.now() - storage.CACHE_TTL_MS - 1 }), false);
});
