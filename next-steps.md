# MYFood Service — Next Steps

Priority-ordered backlog of improvements and missing pieces following the initial implementation.

---

## 1. Developer Experience & Local Setup — ✅ Done

**Why first:** Unblocks all further development and testing.

- [x] Add `dotenv` support so `.env` is loaded automatically in dev (`npm run dev`)
- [x] Add a `data/` directory placeholder (`.gitkeep`) and ensure `data/` is in `.gitignore`
- [x] Add `nodemon` or confirm `tsx watch` restarts cleanly on all file changes (`tsx watch` in use, confirmed working)
- [x] Add a `lint` script with `eslint` + `@typescript-eslint` rules and fix any violations

---

## 2. In-Memory Repository for Testing — ✅ Done

**Why:** The `SqliteFoodItemRepository` writes to disk, making integration tests slow and stateful. An in-memory adapter implementing `FoodItemRepositoryPort` enables fast, isolated tests for application services and controllers.

- [x] Implement `InMemoryFoodItemRepository` in `src/adapters/outbound/persistence/`
- [x] Use it in all integration and end-to-end tests
- [x] Use it as a fallback when `DB_PATH=:memory:` is set

---

## 3. Integration & Controller Tests — ✅ Done

**Why:** Current tests only cover domain logic and unit-level service behaviour. HTTP layer is untested.

- [x] Add `supertest` for HTTP-level integration tests
- [x] Test all `FoodItemController` routes (happy path + validation errors + not found)
- [x] Test `ExpiryAlertController`, `RecipeController`, `ShoppingSummaryController`
- [x] Mock outbound adapters (repository, recipe provider) using the in-memory adapter

---

## 4. Pagination for `GET /food-items` — ✅ Done

**Why:** Without pagination, a large fridge tracker becomes a performance problem.

- [x] Add `page` and `limit` query parameters to `GET /food-items`
- [x] Update `FoodItemRepositoryPort.findAll` to accept `PaginationOptions` (added a separate `findAllPaginated` method; `findAll` kept unpaged for internal consumers that need the full dataset: `shopping-summary`, `recipe`, `expiry-alert` services)
- [x] Return a paginated envelope: `{ data, total, page, limit }`
- [x] Update SQLite adapter with `LIMIT` / `OFFSET` support

---

## 5. Request Logging Middleware — ✅ Done

**Why:** Essential for observability even in early-stage services.

- [x] Add `morgan` (or a lightweight custom middleware) for structured HTTP request logging
- [x] Log method, path, status code, and response time
- [x] Suppress logs in `test` environment

---

## 6. Input Sanitisation & Stricter Validation

**Why:** Current Zod schemas are functional but minimal.

- Enforce `bestBefore` must be a future date on creation
- Normalise `name` input (trim whitespace, prevent duplicates in the same location)
- Add maximum `quantity` bounds
- Return structured error responses consistently (currently mixing Zod shape with manual messages)

---

## 7. Recipe Enrichment

**Why:** The Spoonacular `findByIngredients` endpoint does not return `readyInMinutes` or `servings`. These are set to `0` in the current adapter.

- Call the Spoonacular `/recipes/{id}/information` endpoint to enrich results
- Cache enriched results (in-memory TTL cache) to avoid redundant API calls and stay within rate limits
- Consider a circuit-breaker or graceful degradation if the Spoonacular API is unavailable

---

## 8. Low-Stock Tracking

**Why:** The shopping summary currently only flags expiring items. Items that are simply running low (e.g., 1 egg left) are not surfaced.

- Add a `minimumQuantity` field to `FoodItem` (optional, user-defined threshold)
- Update `buildShoppingSummary` to include items below their minimum quantity
- Add `LOW_STOCK` reason to `ShoppingItem`

---

## 9. Notifications / Alert Polling

**Why:** Expiry alerts are only visible on-demand via `GET /alerts/expiry`. A proactive mechanism provides real value.

- Add a background job (using `node:timers` `setInterval` or a lightweight scheduler) that checks for expiring items on a configurable interval
- Log alerts to stdout as a starting point
- Design the notifier as an outbound port (`NotificationPort`) so email/push/webhook adapters can be added later

---

## 10. OpenAPI / Swagger Documentation

**Why:** Makes the API self-documenting and consumable by frontend clients or API testing tools.

- Add `zod-to-openapi` or `swagger-jsdoc` to generate an OpenAPI 3.0 spec
- Serve Swagger UI at `/api/docs`
- Keep the spec generated from the existing Zod schemas to avoid drift

---

## 11. Authentication & Authorisation

**Why:** The API is currently open with no concept of users. Needed before any public or multi-user deployment.

- Add JWT-based authentication middleware
- Scope food items to a `userId` so multiple users can maintain separate inventories
- Consider API key auth as a simpler alternative for single-user self-hosted deployments

---

## 12. Containerisation

**Why:** Ensures consistent runtime across environments and simplifies deployment.

- Add a `Dockerfile` (multi-stage: build → production image)
- Add a `docker-compose.yml` for local development
- Document container usage in `README.md`
