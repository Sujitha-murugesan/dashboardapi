import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  filterProducts, sortProducts, getCategories, addToCart, setQuantity, removeFromCart,
  cartCount, cartTotal, categoryLabel, formatAge,
} from "../js/logic.js";

const products = JSON.parse(fs.readFileSync(new URL("./fixtures/products.json", import.meta.url), "utf8"));

test("filter by search query (title, description, category)", () => {
  assert.equal(filterProducts(products, { query: "ssd" }).length, 1);
  assert.equal(filterProducts(products, { query: "JACKET" })[0].title, "Lightweight Rain Jacket");
  assert.equal(filterProducts(products, { query: "electronics" }).length, 3);
  assert.equal(filterProducts(products, { query: "zzz" }).length, 0);
});

test("filter by category and query together", () => {
  assert.equal(filterProducts(products, { category: "electronics" }).length, 3);
  assert.equal(filterProducts(products, { category: "jewelery", query: "silver" }).length, 1);
  assert.equal(filterProducts(products, { category: "electronics", query: "jacket" }).length, 0);
});

test("categories are unique and sorted", () => {
  assert.deepEqual(getCategories(products), ["electronics", "jewelery", "men's clothing", "women's clothing"]);
  assert.equal(categoryLabel("men's clothing"), "Men's Clothing");
  assert.equal(categoryLabel("jewelery"), "Jewelry");
});

test("sorting does not mutate and orders correctly", () => {
  const before = products.map((p) => p.id);
  assert.equal(sortProducts(products, "price-desc")[0].price, 199.99);
  assert.equal(sortProducts(products, "price-asc")[0].price, 9.99);
  assert.equal(sortProducts(products, "rating-desc")[0].rating.rate, 4.8);
  assert.equal(sortProducts(products, "name-asc")[0].title, "27-inch Full HD Monitor");
  assert.deepEqual(products.map((p) => p.id), before);
  assert.deepEqual(sortProducts(products, "relevance").map((p) => p.id), before);
});

test("cart add / quantity / remove / totals", () => {
  let cart = [];
  cart = addToCart(cart, products[0]);
  cart = addToCart(cart, products[0]);
  cart = addToCart(cart, products[8]);
  assert.equal(cartCount(cart), 3);
  assert.equal(cartTotal(cart), 54.59); // 2 * 22.30 + 9.99, rounded to cents
  cart = setQuantity(cart, 1, 5);
  assert.equal(cart.find((i) => i.id === 1).qty, 5);
  cart = setQuantity(cart, 1, 0);
  assert.equal(cart.some((i) => i.id === 1), false);
  assert.equal(removeFromCart(cart, 9).length, 0);
});

test("formatAge", () => {
  assert.equal(formatAge(10_000), "just now");
  assert.equal(formatAge(5 * 60_000), "5 minutes ago");
  assert.equal(formatAge(2 * 3_600_000), "2 hours ago");
});
