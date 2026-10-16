// End-to-end behaviour tests + state screenshots (Chromium via Playwright, API mocked).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { startServer } from "./lib/server.mjs";
import { mockApi } from "./lib/mock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = path.join(root, "docs/screenshots");
fs.mkdirSync(shots, { recursive: true });
const { server, base } = await startServer(root);
const browser = await chromium.launch();
const results = [];

async function scenario(name, fn, { viewport = { width: 1280, height: 900 }, mode = "ok", delay = 0, scheme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  const ctl = await mockApi(ctx, root, mode, delay);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await fn({ page, ctl, ctx });
    assert.deepEqual(errors, [], "uncaught page errors");
    results.push({ name, ok: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.log("FAIL", name, "-", e.message);
  } finally { await ctx.close(); }
}

const cards = (page) => page.locator(".product-card");
const waitCards = (page, n) => page.waitForFunction((x) => document.querySelectorAll(".product-card").length === x, n, { timeout: 15000 });
const goShop = (page) => page.goto(`${base}/shop.html`);

await scenario("loading skeleton shows, then 12 products render", async ({ page }) => {
  await goShop(page);
  await page.locator(".skeleton-card").first().waitFor();
  assert.equal(await page.locator("#product-region").getAttribute("aria-busy"), "true");
  await page.screenshot({ path: path.join(shots, "shop-loading-skeleton-1280.png"), fullPage: false });
  await waitCards(page, 12);
  assert.equal(await page.locator(".skeleton-card").count(), 0);
  assert.equal(await page.locator("#product-region").getAttribute("aria-busy"), "false");
  assert.match(await page.locator("#results-status").innerText(), /12 products found/);
  await page.screenshot({ path: path.join(shots, "shop-loaded-1280.png"), fullPage: true });
}, { delay: 900 });

await scenario("real-time search filters without reload", async ({ page }) => {
  await goShop(page); await waitCards(page, 12);
  await page.evaluate(() => { window.__marker = 1; });
  await page.fill("#product-search", "ssd");
  await waitCards(page, 1);
  assert.match(await page.locator("#results-status").innerText(), /1 product found/);
  assert.equal(await page.evaluate(() => window.__marker), 1, "page reloaded");
  await page.fill("#product-search", "nothing-matches");
  await page.locator(".empty-state").waitFor();
  await page.click(".empty-state button");
  await waitCards(page, 12);
  assert.equal(await page.inputValue("#product-search"), "");
});

await scenario("category tabs filter and set aria-pressed", async ({ page }) => {
  await goShop(page); await waitCards(page, 12);
  assert.equal(await page.locator("#category-tabs button").count(), 5);
  await page.click('#category-tabs button[data-category="electronics"]');
  await waitCards(page, 3);
  assert.equal(await page.getAttribute('#category-tabs button[data-category="electronics"]', "aria-pressed"), "true");
  assert.equal(await page.getAttribute('#category-tabs button[data-category="all"]', "aria-pressed"), "false");
  await page.fill("#product-search", "monitor");
  await waitCards(page, 1);
});

await scenario("sorting reorders the DOM", async ({ page }) => {
  await goShop(page); await waitCards(page, 12);
  await page.selectOption("#product-sort", "price-desc");
  assert.equal(await cards(page).first().locator(".price").innerText(), "$199.99");
  await page.selectOption("#product-sort", "price-asc");
  assert.equal(await cards(page).first().locator(".price").innerText(), "$9.99");
  await page.selectOption("#product-sort", "name-asc");
  assert.equal(await cards(page).first().locator(".product-title").innerText(), "27-inch Full HD Monitor");
});

await scenario("cart persists in localStorage across reloads and syncs header badge", async ({ page }) => {
  await goShop(page); await waitCards(page, 12);
  await cards(page).nth(0).locator("[data-add]").click();
  await cards(page).nth(0).locator("[data-add]").click();
  await cards(page).nth(3).locator("[data-add]").click();
  assert.equal(await page.locator("[data-cart-count]").first().innerText(), "3");
  assert.match(await page.locator(".cart-total").innerText(), /\$60\.59/);
  await page.click('[data-cart-action="inc"]');
  assert.equal(await page.locator("[data-cart-count]").first().innerText(), "4");
  await page.reload(); await waitCards(page, 12);
  assert.equal(await page.locator("[data-cart-count]").first().innerText(), "4");
  assert.equal(await page.locator(".cart-item").count(), 2);
  await page.goto(`${base}/index.html`);
  assert.equal(await page.locator("[data-cart-count]").first().innerText(), "4", "badge on another page");
  await page.goto(`${base}/shop.html`); await waitCards(page, 12);
  await page.click('[data-cart-action="clear"]');
  assert.equal(await page.locator("[data-cart-count]").first().innerText(), "0");
});

await scenario("filters/sort/search preferences persist", async ({ page }) => {
  await goShop(page); await waitCards(page, 12);
  await page.click('#category-tabs button[data-category="electronics"]');
  await page.selectOption("#product-sort", "price-asc");
  await page.fill("#product-search", "usb");
  await waitCards(page, 1);
  await page.reload(); await waitCards(page, 1);
  assert.equal(await page.inputValue("#product-search"), "usb");
  assert.equal(await page.inputValue("#product-sort"), "price-asc");
  assert.equal(await page.getAttribute('#category-tabs button[data-category="electronics"]', "aria-pressed"), "true");
});

await scenario("API failure with no cache: error banner + retry recovers", async ({ page, ctl }) => {
  await goShop(page);
  const banner = page.locator("#banner");
  await banner.waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await banner.getAttribute("role"), "alert");
  assert.match(await banner.innerText(), /internet connection/i);
  assert.equal(await cards(page).count(), 0);
  assert.match(await page.locator("#results-status").innerText(), /unavailable/);
  await page.screenshot({ path: path.join(shots, "shop-error-banner-1280.png") });
  ctl.mode = "ok";
  await banner.getByRole("button", { name: "Try again" }).click();
  await waitCards(page, 12);
  assert.equal(await banner.isHidden(), true);
}, { mode: "abort", scheme: "dark" });

await scenario("HTTP 500 shows a friendly message (no raw error text)", async ({ page }) => {
  await goShop(page);
  await page.locator("#banner").waitFor({ state: "visible", timeout: 15000 });
  const t = await page.locator("#banner").innerText();
  assert.match(t, /problems right now/);
  assert.doesNotMatch(t, /server error|HTTP 500/);
}, { mode: "http500" });

await scenario("malformed API payload is handled", async ({ page }) => {
  await goShop(page);
  await page.locator("#banner").waitFor({ state: "visible", timeout: 15000 });
  assert.match(await page.locator("#banner").innerText(), /couldn't read/);
}, { mode: "garbage" });

await scenario("stale cache is shown when the refresh fails", async ({ page, ctl }) => {
  await goShop(page); await waitCards(page, 12);
  ctl.mode = "http500";
  await page.reload();
  await waitCards(page, 12);
  const banner = page.locator("#banner");
  await banner.waitFor({ state: "visible", timeout: 15000 });
  assert.match(await banner.innerText(), /Showing products saved/);
  assert.equal(await cards(page).count(), 12);
  await page.screenshot({ path: path.join(shots, "shop-offline-cache-1280.png") });
});

await scenario("corrupted localStorage does not break the page", async ({ page, ctx }) => {
  await ctx.addInitScript(() => { localStorage.setItem("shop:cart:v1", "{bad"); localStorage.setItem("shop:prefs:v1", "[[["); localStorage.setItem("shop:cache:v1", "oops"); });
  await goShop(page); await waitCards(page, 12);
  assert.equal(await page.locator("[data-cart-count]").first().innerText(), "0");
});

await scenario("XSS-looking product data is rendered as text", async ({ page, ctx }) => {
  await ctx.route(/fakestoreapi\.com\/products/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
    { id: 1, title: '<img src=x onerror="window.__xss=1">Evil', price: 1, description: "d", category: "electronics", image: "https://fakestoreapi.com/img/x.jpg", rating: { rate: 1, count: 1 } }]) }));
  await goShop(page); await waitCards(page, 1);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.match(await page.locator(".product-title").innerText(), /<img src=x/);
});

await scenario("mobile 320px: no horizontal scroll with products, cart and banner", async ({ page }) => {
  await goShop(page); await waitCards(page, 12);
  await cards(page).nth(2).locator("[data-add]").click();
  const m = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  assert.ok(m.s <= m.c, `scrollWidth ${m.s} > clientWidth ${m.c}`);
  await page.screenshot({ path: path.join(shots, "shop-loaded-mobile-320.png"), fullPage: true });
}, { viewport: { width: 320, height: 640 } });

await browser.close(); server.close();
const failed = results.filter((r) => !r.ok);
const md = ["# End-to-end test report", "", "Chromium (Playwright) with the FakeStoreAPI mocked from `test/fixtures/products.json`.", "",
  "| Scenario | Result |", "|---|---|", ...results.map((r) => `| ${r.name} | ${r.ok ? "PASS" : "FAIL: " + r.err} |`), "",
  `**${results.length - failed.length}/${results.length} passed.**`, ""].join("\n");
fs.writeFileSync(path.join(root, "docs/E2E-TEST-REPORT.md"), md);
process.exit(failed.length ? 1 : 0);
