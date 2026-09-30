# MYFood Service — Next Steps

Priority-ordered backlog of improvements and missing pieces following the initial implementation.

Items 1–10 are complete. Items 11–12 were already identified but are expanded below with concrete
implementation notes; items 13–17 are new additions surfaced by reviewing the current state of the
codebase (see individual "Why" sections for the specific gaps observed).

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

## 6. Input Sanitisation & Stricter Validation — ✅ Done

**Why:** Current Zod schemas are functional but minimal.

- [x] Enforce `bestBefore` must be a future date on creation (also enforced on update when `bestBefore` is included in the partial payload)
- [x] Normalise `name` input (trim whitespace via `.trim()` transform, same for `notes`; prevent duplicates (case-insensitive) in the same location via new `findByNameAndLocation` repository method + `ConflictError` → 409)
- [x] Add maximum `quantity` bounds (100,000)
- [x] Return structured error responses consistently (`ZodError` → 400, `NotFoundError` → 404, new `ConflictError` → 409, all as `{ error, details? }`)

---

## 7. Recipe Enrichment — ✅ Done

**Why:** The Spoonacular `findByIngredients` endpoint does not return `readyInMinutes` or `servings`. These are set to `0` in the current adapter.

- [x] Call the Spoonacular `/recipes/{id}/information` endpoint to enrich results (`enrichAll`/`enrichOne` in `SpoonacularRecipeAdapter`, run concurrently via `Promise.allSettled`)
- [x] Cache enriched results (in-memory TTL cache) to avoid redundant API calls and stay within rate limits (`TtlCache` in `src/adapters/outbound/recipe-provider/ttl-cache.ts`, 6h default TTL)
- [x] Consider a circuit-breaker or graceful degradation if the Spoonacular API is unavailable (per-request 5s timeout via `AbortSignal.timeout`; failures degrade to `readyInMinutes: 0, servings: 0` without throwing; lightweight circuit breaker opens for 60s after 3 consecutive enrichment failures)

---

## 8. Low-Stock Tracking — ✅ Done

**Why:** The shopping summary currently only flags expiring items. Items that are simply running low (e.g., 1 egg left) are not surfaced.

- [x] Add a `minimumQuantity` field to `FoodItem` (optional, user-defined threshold)
- [x] Update `buildShoppingSummary` to include items below their minimum quantity (fixed a latent bug where the pre-filter on `bestBefore` made the `LOW_STOCK` branch unreachable; expiry reasons take precedence over `LOW_STOCK` when both apply)
- [x] Add `LOW_STOCK` reason to `ShoppingItem` (the enum value already existed but was dead code; now reachable)
- [x] SQLite adapter: added `minimum_quantity` column plus a `PRAGMA table_info` + `ALTER TABLE` guard so existing on-disk databases are migrated in place (no migration framework in this project)

---

## 9. Notifications / Alert Polling — ✅ Done

**Why:** Expiry alerts are only visible on-demand via `GET /alerts/expiry`. A proactive mechanism provides real value.

- [x] Add a background job (`NotificationPoller` in `src/application/notification-poller.ts`, using `setInterval`) that checks for expiring items on a configurable interval (`NOTIFICATION_POLL_INTERVAL_MS`, default 1h); disabled in `test` env, started/stopped in `src/index.ts` with `SIGTERM`/`SIGINT` handlers for graceful shutdown
- [x] Log alerts to stdout as a starting point (`ConsoleNotificationAdapter` in `src/adapters/outbound/notification/`)
- [x] Design the notifier as an outbound port (`NotificationPort` in `src/core/ports/outbound/notification.port.ts`) so email/push/webhook adapters can be added later

---

## 10. OpenAPI / Swagger Documentation — ✅ Done

**Why:** Makes the API self-documenting and consumable by frontend clients or API testing tools.

- [x] Add `@asteasolutions/zod-to-openapi` to generate an OpenAPI 3.0 spec from existing Zod schemas (`src/adapters/inbound/http/openapi/registry.ts` registers all 9 routes plus shared error/response component schemas; `spec.ts` generates and caches the document)
- [x] Serve Swagger UI at `/api/docs` (via `swagger-ui-express`, wired in `app.ts`), backed by a raw spec at `/api/docs.json`
- [x] Spec is generated directly from the domain Zod schemas (`FoodItemSchema`, `CreateFoodItemSchema`, `UpdateFoodItemSchema`, controller query schemas) — no hand-written duplicate spec, so it can't drift. `.openapi()` annotation calls are confined to the new `openapi/` adapter module, keeping `core/domain` free of infrastructure imports

---

## 11. Authentication & Authorisation — ✅ Done

**Why:** The API is currently open with no concept of users. Needed before any public or multi-user deployment.

- [x] Add JWT-based authentication middleware (`jsonwebtoken` + `AuthServicePort`/`AuthService`, `src/application/auth.service.ts`; token verification (`jsonwebtoken`, `bcrypt`) is confined to the application/adapters layers, `core/domain` and `core/ports` stay infrastructure-free)
- [x] Add a `users` table/repository (`UserRepositoryPort`, `SqliteUserRepository`, `InMemoryUserRepository`) and a login/register flow (`POST /api/v1/auth/register`, `POST /api/v1/auth/login`)
- [x] Scope food items to a `userId`: added to the `FoodItem` domain type, threaded through `FoodItemRepositoryPort` methods (`findAll`, `findAllPaginated`, `findById`, `findByNameAndLocation`, `update`, `delete`), plus a `user_id` column + index on `SqliteFoodItemRepository` (same `PRAGMA table_info` + `ALTER TABLE` migration guard used for `minimum_quantity`)
- [x] `InMemoryFoodItemRepository` updated to filter by `userId` too, so integration tests stay accurate
- [x] `express-jwt`-style bearer middleware (`src/adapters/inbound/http/middleware/auth.middleware.ts`) applied to all `/food-items`, `/alerts`, `/recipes`, `/shopping-summary` routes (not `/health`, `/api/docs`, `/api/v1/auth/*`)
- [x] OpenAPI registry updated with a `bearerAuth` securityScheme and all protected routes marked as requiring it
- [x] The background `NotificationPoller` now fans out per-registered-user (via a new `UserRepositoryPort.listAll()`) since expiry alerts are user-scoped
- [x] Hardened after independent review (two review agents + one QA agent converged on the same findings): `JWT_SECRET` now fails fast (throws at startup) instead of silently defaulting to an empty string outside `test` env — an empty HMAC secret would let anyone forge tokens; `AuthService`'s constructor also rejects an empty secret as defense-in-depth; `login` now runs a dummy `bcrypt.compare` against a fixed hash when the email isn't found, closing a timing side-channel that allowed user enumeration via response latency (status/message were already generic, but timing wasn't); the `user_id` migration now refuses to start (throws with a remediation hint) if it finds pre-existing rows with `NULL user_id`, rather than silently making them permanently invisible through every scoped query
- [x] Added test coverage for the above: expired-token rejection, empty-secret constructor guard, and a migration-guard test asserting startup throws when orphaned (no-`user_id`) rows exist
- Known, accepted limitation (not a blocker): tokens are not revocable — `verifyToken` checks signature/expiry only, not whether the referenced user still exists. Fine today since there's no user-deletion feature; would need a `findById` check per request (or a refresh-token strategy) if account deletion/deactivation is added later

---


## 12. Containerisation — ✅ Done

**Why:** Ensures consistent runtime across environments and simplifies deployment.

- [x] Added a multi-stage `Dockerfile` (`node:24-slim` build stage running `npm ci && npm run build`, then `npm prune --omit=dev`; slim `node:24-slim` production stage copies the pruned `node_modules`, compiled `dist/`, and `package.json` from the build stage — no compiler toolchain in the final image, runs as an unprivileged `app` user, not root)
- [x] Added `docker-compose.yml` for local development, bind-mounting `./data` to `/app/data` so the SQLite file persists across container restarts, reading env vars from `.env`, and mapping the configured `PORT`
- [x] Added `.dockerignore` (`node_modules`, `dist`, `data`, `.env*` except `.env.example`, `.git`, tests, docs)
- [x] Documented container usage in `README.md` ("Running with Docker" section) and cross-referenced from `docs/dev/developer-guide.md`
- [x] Added a `docker-compose.yml` `healthcheck` against `GET /health` via `curl`
- [x] Hardened after independent review: initial version ran as root and re-installed the full `python3/make/g++` compiler toolchain in the production stage (needed to (re)build `better-sqlite3`/`bcrypt` native bindings, but both stages already share the same `node:24-slim` base/libc, so this was unnecessary bloat/attack surface); fixed by building native modules once in the build stage, pruning dev dependencies, and copying the already-built `node_modules` into production — no toolchain ships in the final image, verified by `docker build` + manual `docker run`/`docker exec whoami` (confirmed non-root `app` user, ~516MB image, no `gcc`/`python3`/`make` present)
- [x] Set an explicit `ENV DB_PATH=/app/data/myfood.db` default in the Dockerfile so the SQLite file always lands in the volume-mounted directory even if `DB_PATH` is omitted from `.env` (the bare-metal fallback in `src/config.ts` resolves elsewhere and isn't volume-mounted) — verified data persists across `docker restart` without `DB_PATH` being set at all, using only the image's built-in default

---

## 13. Deeper Readiness Check

**Why:** `GET /health` already exists (`src/adapters/inbound/http/app.ts`) and returns a static `{ status, service, timestamp }` payload, which is enough for a basic liveness probe but doesn't verify the database connection is actually usable.

- Add a `GET /health/ready` (or extend `/health` with a `?deep=true` flag) that runs a trivial `SELECT 1` against the SQLite connection and reports `503` if it fails
- Useful once containerised (item 12) for a Docker/`docker-compose` healthcheck, and later for k8s readiness probes
- Exclude `/health` from request logging noise (or log at a lower verbosity) once it starts being polled frequently by orchestrators

---

## 14. Structured / Leveled Logging

**Why:** `morgan` covers HTTP access logs, but application-level logs (config warnings, notification poller, Spoonacular circuit breaker events) currently use raw `console.log`/`console.warn` with inconsistent formatting.

- Introduce a lightweight structured logger (e.g. `pino`) as a cross-cutting concern, or a small internal wrapper if a new dependency isn't wanted
- Replace ad-hoc `console.*` calls in `src/config.ts`, `notification-poller.ts`, and `spoonacular.adapter.ts` with the shared logger
- Support a `LOG_LEVEL` env var and ensure `test` env stays quiet (mirroring the existing morgan suppression)

---

## 15. Rate Limiting & Basic Hardening

**Why:** The API has no protection against abusive clients, and this becomes more important once auth (item 11) makes per-user resource usage meaningful.

- Add `express-rate-limit` (or similar) on all routes, with a stricter limit on `/recipes/suggestions` since it proxies to the metered Spoonacular API
- Add `helmet` for standard security headers
- Add a request body size limit (Express `json({ limit: ... })`) to guard against oversized payloads

---

## 16. CI Pipeline

**Why:** `lint`, `typecheck`, and `test` all exist as scripts but nothing currently runs them automatically on push/PR.

- Add a GitHub Actions workflow (`.github/workflows/ci.yml`) running `npm ci`, `npm run lint`, `npm run typecheck`, and `npm test` on Node 24
- Optionally upload `vitest` coverage as a build artifact or badge
- Gate merges on this workflow passing once the repository has a hosted remote with branch protection

---

## 17. Database Migration Strategy

**Why:** Schema changes so far (`minimum_quantity` in item 8, and the prospective `user_id` in item 11) have been handled with ad-hoc `PRAGMA table_info` + `ALTER TABLE` guards directly in `SqliteFoodItemRepository`. This works but doesn't scale and has no rollback story.

- Evaluate a lightweight migration tool compatible with `better-sqlite3` (e.g. a hand-rolled numbered-migrations runner, or a library) rather than continuing to grow ad-hoc guards
- Track applied migrations in a `schema_migrations` table
- Keep the existing in-place guards working for upgrades from current on-disk databases, or provide a one-time migration bridging them into the new system
