import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fetchProducts, ApiError, friendlyMessage } from "../js/api.js";

const products = JSON.parse(fs.readFileSync(new URL("./fixtures/products.json", import.meta.url), "utf8"));
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const status = (code) => ({ ok: false, status: code, json: async () => ({}) });
const noSleep = async () => {};

test("returns validated products on success", async () => {
  const out = await fetchProducts({ fetchImpl: async () => ok(products), sleep: noSleep });
  assert.equal(out.length, 12);
  assert.equal(out[0].rating.rate, 4.1);
});

test("retries server errors then succeeds", async () => {
  let calls = 0;
  const fetchImpl = async () => (++calls < 3 ? status(503) : ok(products));
  const out = await fetchProducts({ fetchImpl, sleep: noSleep });
  assert.equal(calls, 3);
  assert.equal(out.length, 12);
});

test("does not retry 404", async () => {
  let calls = 0;
  await assert.rejects(fetchProducts({ fetchImpl: async () => { calls++; return status(404); }, sleep: noSleep }),
    (e) => e instanceof ApiError && e.kind === "http" && e.status === 404);
  assert.equal(calls, 1);
});

test("network failure retries then reports network error", async () => {
  let calls = 0;
  await assert.rejects(fetchProducts({ fetchImpl: async () => { calls++; throw new TypeError("fail"); }, sleep: noSleep, retries: 2 }),
    (e) => e.kind === "network");
  assert.equal(calls, 3);
});

test("timeout is reported as timeout", async () => {
  const fetchImpl = (_u, { signal }) => new Promise((_res, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))));
  await assert.rejects(fetchProducts({ fetchImpl, timeoutMs: 20, retries: 0, sleep: noSleep }), (e) => e.kind === "timeout");
});

test("invalid JSON and wrong shape are bad-data", async () => {
  await assert.rejects(fetchProducts({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error("x"); } }), sleep: noSleep }), (e) => e.kind === "bad-data");
  await assert.rejects(fetchProducts({ fetchImpl: async () => ok({ nope: true }), sleep: noSleep }), (e) => e.kind === "bad-data");
  await assert.rejects(fetchProducts({ fetchImpl: async () => ok([{ foo: 1 }]), sleep: noSleep }), (e) => e.kind === "bad-data");
});

test("friendly messages never leak raw errors", () => {
  assert.match(friendlyMessage(new ApiError("network", "x")), /internet connection/);
  assert.match(friendlyMessage(new ApiError("http", "x", 500)), /problems/);
  assert.match(friendlyMessage(new ApiError("http", "x", 429)), /Too many/);
  assert.match(friendlyMessage(new Error("boom")), /Something went wrong/);
});
