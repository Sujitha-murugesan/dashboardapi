// Captures responsive screenshots and checks for horizontal overflow.
// Usage: npm run screenshots   (first time: npx playwright install chromium)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./lib/server.mjs";
import { mockApi } from "./lib/mock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/screenshots");
fs.mkdirSync(outDir, { recursive: true });

const pages = ["index", "shop", "users", "reports", "settings"];
const viewports = [
  { name: "mobile-320", width: 320, height: 640 },
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-414", width: 414, height: 896 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
];
const shots = new Set([
  "index/mobile-320/light", "index/mobile-320/dark", "index/tablet-768/light", "index/tablet-768/dark",
  "index/laptop-1024/light", "index/laptop-1024/dark", "index/desktop-1440/light", "index/desktop-1440/dark",
  "users/mobile-320/light", "users/desktop-1440/light", "reports/mobile-320/light", "reports/desktop-1440/light",
  "settings/mobile-320/light", "settings/desktop-1440/dark", "shop/mobile-320/dark", "shop/tablet-768/light", "shop/desktop-1440/dark",
]);

const { server, base } = await startServer(root);
const browser = await chromium.launch();
const rows = [];
let failures = 0;

for (const vp of viewports) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: scheme });
    await mockApi(ctx, root);
    const page = await ctx.newPage();
    for (const name of pages) {
      await page.goto(`${base}/${name}.html`);
      await page.waitForLoadState("networkidle");
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const vw = de.clientWidth;
        const offenders = [...document.body.querySelectorAll("*")]
          .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !el.closest(".visually-hidden") && !el.classList.contains("skip-link") && !el.classList.contains("visually-hidden") && getComputedStyle(el).position !== "absolute"; })
          .slice(0, 3).map((el) => el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""));
        return { scrollWidth: de.scrollWidth, clientWidth: vw, offenders };
      });
      const ok = m.scrollWidth <= m.clientWidth;
      if (!ok) failures++;
      rows.push({ page: name, vp: vp.name, scheme, ...m, ok });
      const key = `${name}/${vp.name}/${scheme}`;
      if (shots.has(key)) await page.screenshot({ path: path.join(outDir, `${name}-${vp.name}-${scheme}.png`), fullPage: true });
    }
    // Modal screenshot on mobile + desktop
    if (scheme === "light" && (vp.width === 320 || vp.width === 1440)) {
      await page.goto(`${base}/users.html`);
      await page.click('[data-open-dialog="add-user-dialog"]');
      await page.screenshot({ path: path.join(outDir, `users-modal-${vp.name}-light.png`) });
    }
    await ctx.close();
  }
}
await browser.close();
server.close();

const md = ["# Responsive test report", "", "Check: `document.documentElement.scrollWidth <= clientWidth` (no page-level horizontal scrollbar), run in Chromium via Playwright.", "",
  "| Page | Viewport | Theme | scrollWidth | clientWidth | Result |", "|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.page} | ${r.vp} | ${r.scheme} | ${r.scrollWidth} | ${r.clientWidth} | ${r.ok ? "PASS" : "FAIL " + r.offenders.join(", ")} |`),
  "", `**${rows.length - failures}/${rows.length} checks passed.**`, ""].join("\n");
fs.writeFileSync(path.join(root, "docs/RESPONSIVE-TEST-REPORT.md"), md);
console.log(md.split("\n").slice(-3).join("\n"));
process.exit(failures ? 1 : 0);
