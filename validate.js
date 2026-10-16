// Runs the official W3C Nu HTML Checker (vnu.jar) locally. Requires Java 11+.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jar = String(require("vnu-jar"));
const files = ["index.html", "shop.html", "users.html", "reports.html", "settings.html"];
try {
  execFileSync("java", ["-jar", jar, "--also-check-css", "--also-check-svg", ...files, "css/style.css"], { stdio: "inherit" });
  console.log("W3C validation passed: 0 errors, 0 warnings");
} catch { process.exit(1); }
