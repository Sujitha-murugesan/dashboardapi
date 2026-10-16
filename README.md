# Dynamic JavaScript DOM Logic and REST API Client

Adds a live **Products** page to the accessible, responsive dashboard. It fetches from the public [FakeStoreAPI](https://fakestoreapi.com/products) with `async/await`, filters/sorts in real time without page reloads, caches state in `localStorage`, and handles failures with user-friendly banners and loading skeletons.

## Features
| Requirement | Where |
|---|---|
| `async/await` fetch to a public REST API | `js/api.js` (`fetchProducts`), 8s timeout via `AbortController`, 2 retries with exponential backoff on network/timeout/5xx (not 4xx) |
| Real-time search | `js/shop.js` (debounced input, matches title, description, category) |
| Category tabs | Built from API data; `aria-pressed` button group |
| Sorting | Featured, price asc/desc, top rated, name A-Z (`js/logic.js`) |
| localStorage state | `js/storage.js`: **cart**, **preferences** (search/category/sort), **products cache** (10 min freshness) |
| Error banners | `role="alert"` banner with "Try again"; messages map to error kinds (network, timeout, HTTP, bad data), never raw errors |
| Loading skeletons | 8 shimmer cards, `aria-busy`, respects reduced motion |
| Offline resilience | If a refresh fails but a cache exists, saved products are shown with a warning banner |

## Architecture
```
js/api.js      REST client, retry/timeout, validation, ApiError + friendlyMessage
js/logic.js    Pure functions: filter, sort, cart math, formatting (unit tested)
js/storage.js  Safe localStorage (blocked storage, quota, corrupted JSON handled)
js/shop.js     UI controller: state, rendering, events (DOM built with textContent, no innerHTML)
js/badge.js    Header "Cart (n)" on every page, synced across tabs
test/          Unit tests (node:test) + fixtures
scripts/e2e.mjs  Browser tests (Playwright, API mocked)
```

## Run
Requires Node 18+. ES modules need http, so do not open the files via `file://`.
```bash
npm install
npm run serve        # http://localhost:8080/shop.html
```

## Verify
```bash
npm test             # 18 unit tests: filtering, sorting, cart, retries, timeouts, storage
npx playwright install chromium   # first time only
npm run e2e          # 13 browser scenarios + state screenshots
npm run screenshots  # overflow check: 5 pages x 6 viewports x 2 themes
npm run validate     # W3C Nu validator (Java): 0 errors, 0 warnings
```

## Proof (in `docs/`)
- `screenshots/`: shop loaded, loading skeleton, error banner, offline-cache warning, 320px mobile, plus dashboard shots.
- `E2E-TEST-REPORT.md`, `RESPONSIVE-TEST-REPORT.md`.

## Notes
- The e2e tests mock the API from `test/fixtures/products.json` so they are deterministic. The code targets the real FakeStoreAPI response shape (`id, title, price, description, category, image, rating`); on the live site, product images come from the API.
- The API spells the category "jewelery"; the UI displays it as "Jewelry".
- Cart is a demo: stored only in this browser, no checkout.

## Publish
```bash
git init && git add . && git commit -m "API client with search, filters, cart and caching"
git remote add origin <repo-url> && git push -u origin main
```
