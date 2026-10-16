// Assembles src/pages/*.html + src/components/*.html into root-level pages.
// Usage: node scripts/build.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const comp = (n) => fs.readFileSync(path.join(root, "src/components", `${n}.html`), "utf8").trimEnd();
const pagesDir = path.join(root, "src/pages");

for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith(".html"))) {
  const name = file.replace(/\.html$/, "");
  let html = fs.readFileSync(path.join(pagesDir, file), "utf8");
  html = html.replace(/^([ \t]*)<!-- @include (\w+) -->/gm, (_m, indent, n) =>
    comp(n).split("\n").map((l) => (l ? indent + l : l)).join("\n"));
  html = html.replace(/\{\{current:(\w+)\}\}/g, (_m, n) => (n === name ? ' aria-current="page"' : ""));
  fs.writeFileSync(path.join(root, file), html);
  console.log("built", file);
}
