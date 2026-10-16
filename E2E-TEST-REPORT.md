# End-to-end test report

Chromium (Playwright) with the FakeStoreAPI mocked from `test/fixtures/products.json`.

| Scenario | Result |
|---|---|
| loading skeleton shows, then 12 products render | PASS |
| real-time search filters without reload | PASS |
| category tabs filter and set aria-pressed | PASS |
| sorting reorders the DOM | PASS |
| cart persists in localStorage across reloads and syncs header badge | PASS |
| filters/sort/search preferences persist | PASS |
| API failure with no cache: error banner + retry recovers | PASS |
| HTTP 500 shows a friendly message (no raw error text) | PASS |
| malformed API payload is handled | PASS |
| stale cache is shown when the refresh fails | PASS |
| corrupted localStorage does not break the page | PASS |
| XSS-looking product data is rendered as text | PASS |
| mobile 320px: no horizontal scroll with products, cart and banner | PASS |

**13/13 passed.**
