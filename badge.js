// Keeps the header cart count in sync on every page (and across tabs).
import { loadCart } from "./storage.js";
import { cartCount } from "./logic.js";

function update() {
  const n = String(cartCount(loadCart()));
  document.querySelectorAll("[data-cart-count]").forEach((el) => { el.textContent = n; });
}
update();
window.addEventListener("cart:change", update);
window.addEventListener("storage", update);
