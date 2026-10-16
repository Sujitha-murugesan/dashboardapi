// REST client for FakeStoreAPI (https://fakestoreapi.com). Uses async/await,
// per-request timeout (AbortController), retry with exponential backoff, and typed errors.

export const API_URL = "https://fakestoreapi.com/products";

export class ApiError extends Error {
  /** kind: "network" | "timeout" | "http" | "bad-data" */
  constructor(kind, message, status) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function friendlyMessage(err) {
  if (!(err instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (err.kind) {
    case "network": return "We couldn't reach the store. Check your internet connection and try again.";
    case "timeout": return "The store is taking too long to respond. Please try again.";
    case "bad-data": return "We received product data we couldn't read. Please try again later.";
    case "http":
      if (err.status === 429) return "Too many requests. Please wait a moment and try again.";
      if (err.status >= 500) return "The store service is having problems right now. Please try again shortly.";
      return `The store couldn't complete the request (error ${err.status}).`;
    default: return "Something went wrong. Please try again.";
  }
}

export function validateProducts(data) {
  if (!Array.isArray(data)) throw new ApiError("bad-data", "Expected an array of products");
  const ok = data.filter((p) => p && Number.isFinite(p.id) && typeof p.title === "string"
    && Number.isFinite(p.price) && typeof p.category === "string" && typeof p.image === "string");
  if (data.length > 0 && ok.length === 0) throw new ApiError("bad-data", "No valid products in response");
  return ok.map((p) => ({
    id: p.id, title: p.title, price: p.price, category: p.category, image: p.image,
    description: typeof p.description === "string" ? p.description : "",
    rating: { rate: Number(p.rating?.rate) || 0, count: Number(p.rating?.count) || 0 },
  }));
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchProducts({
  url = API_URL, timeoutMs = 8000, retries = 2, backoffMs = 400,
  fetchImpl = (...a) => fetch(...a), sleep = defaultSleep,
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new ApiError("http", `HTTP ${res.status}`, res.status);
      let data;
      try { data = await res.json(); } catch { throw new ApiError("bad-data", "Response was not valid JSON"); }
      return validateProducts(data);
    } catch (err) {
      if (err instanceof ApiError) lastError = err;
      else if (err && err.name === "AbortError") lastError = new ApiError("timeout", "Request timed out");
      else lastError = new ApiError("network", "Network request failed");
      const retryable = lastError.kind === "network" || lastError.kind === "timeout"
        || (lastError.kind === "http" && lastError.status >= 500);
      if (!retryable || attempt === retries) throw lastError;
      await sleep(backoffMs * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
