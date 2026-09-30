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

## 13. Deeper Readiness Check — ✅ Done

**Why:** `GET /health` already exists (`src/adapters/inbound/http/app.ts`) and returns a static `{ status, service, timestamp }` payload, which is enough for a basic liveness probe but doesn't verify the database connection is actually usable.

- [x] Added `GET /health/ready`, which runs a trivial `SELECT 1` against the SQLite connection via a new `HealthCheckPort` (`core/ports/outbound/health-check.port.ts`), implemented by `SqliteHealthCheckAdapter` (wraps the `better-sqlite3` `Database` instance, exposed via a new `getConnection()` on `SqliteFoodItemRepository`) and `InMemoryHealthCheckAdapter` (always healthy, used for the `DB_PATH=:memory:` fallback and in tests); returns `200` on success, `503` on failure
- [x] Wired in `src/index.ts` alongside the other outbound adapters; no auth required (registered in `app.ts` before the `/api/v1` router, same as `/health`)
- [x] Excluded `/health` and `/health/ready` from `morgan` request logging noise via a `skip` predicate in `request-logger.middleware.ts`
- [x] Added to the OpenAPI registry (200/503 responses documented, no security requirement)
- [x] Useful once containerised (item 12) for a Docker/`docker-compose` healthcheck, and later for k8s readiness probes

---

## 14. Structured / Leveled Logging — ✅ Done

**Why:** `morgan` covers HTTP access logs, but application-level logs (config warnings, notification poller, Spoonacular circuit breaker events) currently use raw `console.log`/`console.warn` with inconsistent formatting.

- [x] Introduced `pino` as a lightweight structured logger, exposed as a shared `logger` instance from `src/logger.ts` (top-level, alongside `config.ts`, since it's a cross-cutting concern kept out of `core/domain` and `core/ports`)
- [x] Replaced ad-hoc `console.*` calls in `src/application/notification-poller.ts`, `src/adapters/outbound/recipe-provider/spoonacular.adapter.ts`, `src/adapters/outbound/notification/console-notification.adapter.ts`, `src/adapters/inbound/http/error-handler.ts`, and the `src/index.ts` startup banners with the shared logger (the `SPOONACULAR_API_KEY` warning in `src/config.ts` intentionally still uses `console.warn` — `logger.ts` imports `config.ts`, so using the logger there would be circular)
- [x] Added a `LOG_LEVEL` env var (default `info`), read via `config.ts` following its existing pattern, documented in `.env.example`
- [x] `test` env stays quiet: the logger is forced to `silent` level when `NODE_ENV=test`, mirroring the existing morgan suppression in `request-logger.middleware.ts`
- [x] Updated tests that previously spied on `console.log`/`console.warn`/`console.error` (`console-notification.adapter.test.ts`, `notification-poller.test.ts`, `app.test.ts`) to spy on the shared `logger` instead
- [x] Hardened after independent review: `error-handler.ts`'s catch-all handler originally logged the raw caught error object (`{ err }`) — for malformed JSON request bodies, Express's body-parser attaches the raw unparsed body (including plaintext passwords on `/auth/register`/`/auth/login`) as `.body` on the thrown `SyntaxError`, which would have been logged verbatim. Fixed by logging only a minimal safe subset (`name`, `message`, `stack`) instead of the raw object; verified via a live repro (malformed JSON with a password in the body no longer appears in log output)

---

## 15. Rate Limiting & Basic Hardening — ✅ Done

**Why:** The API has no protection against abusive clients, and this becomes more important once auth (item 11) makes per-user resource usage meaningful.

- [x] Added `express-rate-limit`: a general limiter (`RATE_LIMIT_MAX`, default 200/15min/IP) applied to all `/api/v1` routes in `app.ts`, plus a stricter limiter on `/api/v1/recipes/suggestions` (`RECIPE_RATE_LIMIT_MAX`, default 20/15min/IP, since it proxies the metered Spoonacular API) and on `/api/v1/auth/register`/`/api/v1/auth/login` (`AUTH_RATE_LIMIT_MAX`, default 10/15min/IP, to mitigate brute-force/enumeration), both wired in `router.ts` (`src/adapters/inbound/http/middleware/rate-limit.middleware.ts`)
- [x] Added `helmet`, applied globally in `app.ts` for standard security headers
- [x] Added a request body size limit via `express.json({ limit: config.bodyLimit })` (`BODY_LIMIT`, default `100kb`)
- [x] Rate limiting is skipped by default under `NODE_ENV=test` (mirroring the existing morgan/pino test-env suppression patterns) so the 184 pre-existing HTTP integration tests, which fire many rapid sequential requests, are unaffected; a `forceEnable` escape hatch on the limiter factories allows dedicated rate-limit tests to exercise real 429 behaviour without touching global env/config
- [x] Added `.env.example`/README entries for `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `RECIPE_RATE_LIMIT_MAX`, `BODY_LIMIT`
- [x] Added tests (`rate-limit.middleware.test.ts`): confirms the real app's limiter is skipped in test env, confirms a low-max limiter does trigger 429, confirms helmet headers (`x-content-type-options`) are present, confirms an oversized JSON body is rejected with 413
- [x] Hardened after independent review: the original 413 test used a bare throwaway Express app with no `errorHandler` at all, so it never actually exercised the real app's error-handling path — and the real path was broken (body-parser's `PayloadTooLargeError` fell through `error-handler.ts`'s generic branch and returned a raw **500** instead of 413). Fixed by adding an explicit `entity.too.large` check in `error-handler.ts` that returns a structured `413 { error }`, and added a second regression test that POSTs an oversized body through the real `buildTestApp()`/router/error-handler stack to catch this class of bug in future
- Follow-up flagged by review, not yet addressed: no `app.set('trust proxy', ...)` is configured. Deployed behind a reverse proxy (nginx/ALB/k8s ingress), `express-rate-limit`'s default IP-keying would bucket all clients behind that proxy together (one abusive client could 429-lock out everyone) unless `trust proxy` is configured correctly for the actual deployment topology. Should be addressed (e.g. a `TRUST_PROXY` env var, explicit hop count) before any production deployment behind a proxy — tracked here rather than guessed at, since the correct value depends on infrastructure not yet decided

---

## 16. CI Pipeline — ✅ Done

**Why:** `lint`, `typecheck`, and `test` all exist as scripts but nothing currently runs them automatically on push/PR.

- [x] Add a GitHub Actions workflow (`.github/workflows/ci.yml`) running `npm ci`, `npm run lint`, `npm run typecheck`, and `npm test` on Node 24 (via `.nvmrc`), on push/PR to any branch
- [x] Cache npm deps via `actions/setup-node@v4`'s built-in `cache: 'npm'`
- [x] Add a CI status badge to `README.md`
- Not done (optional, left for later): uploading `vitest` coverage as a build artifact — `test:coverage` script exists but isn't wired into the workflow
- Gate merges on this workflow passing once the repository has branch protection configured

---

## 17. Database Migration Strategy — ✅ Done

**Why:** Schema changes so far (`minimum_quantity` in item 8, and the prospective `user_id` in item 11) have been handled with ad-hoc `PRAGMA table_info` + `ALTER TABLE` guards directly in `SqliteFoodItemRepository`. This works but doesn't scale and has no rollback story.

- [x] Built a hand-rolled numbered-migrations runner (`src/adapters/outbound/persistence/migrations/migration-runner.ts`) — no new dependency, `better-sqlite3` (already a dependency) is all that's required. Creates a `schema_migrations` table if missing, then runs any migrations not yet recorded as applied, each wrapped in a `db.transaction()` so a failing migration leaves no partial state
- [x] Four numbered migration files encode the exact historical schema changes: `001-create-food-items.ts` (original table, pre-`minimum_quantity`/`user_id`), `002-add-minimum-quantity.ts`, `003-add-user-id-to-food-items.ts` (column + index), `004-create-users.ts`
- [x] Idempotency/backfill strategy chosen: rather than a separate one-time detection-and-backfill pass, each migration's `up()` is written to be idempotent-safe on its own (`CREATE TABLE IF NOT EXISTS`, `PRAGMA table_info` column-existence check before `ALTER TABLE ADD COLUMN`, `CREATE INDEX IF NOT EXISTS`). This means it's always safe to run a migration against a database that already has that change physically present (via the old ad-hoc guards) — it's a no-op, gets recorded in `schema_migrations`, and the runner itself stays simple with no special-cased detection logic that could drift out of sync with what the migrations actually do
- [x] Both `SqliteFoodItemRepository` and `SqliteUserRepository` open a connection to the same on-disk file and now run the same full `allMigrations` list at construction time (via `src/adapters/outbound/persistence/migrations/index.ts`), so a fresh database always ends up with the complete schema regardless of which repository is constructed first
- [x] The orphaned-`user_id`-rows startup guard from item 11 is preserved, but kept *outside* the migration system as a `assertNoOrphanedUserIdRows()` check that runs on every `SqliteFoodItemRepository` construction — it's a runtime data invariant that needs re-checking on every startup, not a one-time schema change that should only run once
- [x] Tests: unit tests for the runner itself (`migrations/__tests__/migration-runner.test.ts` — applies pending migrations in order, skips already-applied ones, records them in `schema_migrations`, rolls back a failing migration's partial changes via the transaction wrapper, and tolerates a table already present outside the migration system); a new `food-item.sqlite.repository.test.ts` case simulating a fully legacy on-disk database (ad-hoc `minimum_quantity`/`user_id` columns and index already present, no `schema_migrations` table, no `users` table) and confirming the runner brings it up to the current schema (all 4 migrations recorded, `users` table created) without errors and without touching the pre-existing row's data; the orphaned-rows guard test is preserved unchanged and still passes
- [x] Full `SqliteFoodItemRepository`/`SqliteUserRepository` and overall test suites re-run clean after the refactor (196 tests passing, up from the 190 baseline)
- [x] Hardened after independent review: the initial version read `schema_migrations` and ran pending migrations in *separate* transactions (one per migration plus an un-transacted read), which a live 8-concurrent-process reproduction confirmed was a genuine race — every racing process crashed (`UNIQUE constraint failed: schema_migrations.id` / `database is locked`) and migrations were left half-applied. Fixed by wrapping the entire "read applied ids -> run all pending -> record" pass in a single `db.transaction(...).exclusive()` call, so only one connection can run migrations at a time; a failure now rolls back the *whole* batch, not just the failing migration. Re-ran the same 8-concurrent-process reproduction after the fix: all 8 processes started successfully, and the resulting database had all 4 migrations recorded exactly once with the correct final schema. Added a regression test (`migration-runner.test.ts`) confirming a later migration's failure rolls back an earlier migration committed in the *same* run, not just its own changes

