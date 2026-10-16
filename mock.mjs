// Mocks https://fakestoreapi.com so tests and screenshots are deterministic and work offline.
import fs from "node:fs";
import path from "node:path";

export function loadFixture(root) {
  return fs.readFileSync(path.join(root, "test/fixtures/products.json"), "utf8");
}

const IMG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c7dcff"/><circle cx="100" cy="90" r="40" fill="#0b5cad"/><rect x="50" y="145" width="100" height="14" rx="7" fill="#0b5cad"/></svg>';

/** mode: "ok" | "slow" | "http500" | "abort" | "garbage". Returns controller to change mode at runtime. */
export async function mockApi(context, root, initial = "ok", delayMs = 0) {
  const ctl = { mode: initial, delayMs, calls: 0 };
  await context.route(/fakestoreapi\.com\/img\//, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: IMG }));
  await context.route(/fakestoreapi\.com\/products/, async (route) => {
    ctl.calls++;
    if (ctl.delayMs) await new Promise((r) => setTimeout(r, ctl.delayMs));
    switch (ctl.mode) {
      case "abort": return route.abort("failed");
      case "http500": return route.fulfill({ status: 500, body: "server error" });
      case "garbage": return route.fulfill({ status: 200, contentType: "application/json", body: '{"unexpected":true}' });
      default: return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: loadFixture(root) });
    }
  });
  return ctl;
}
