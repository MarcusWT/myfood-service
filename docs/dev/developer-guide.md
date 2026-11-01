# Developer Guide

This guide covers running MYFood Service locally for testing and debugging.

## Prerequisites

- Node 24 LTS (see `.nvmrc`). Run `nvm use` to switch to the correct version.
- No external database is required — the service uses `better-sqlite3`, which ships with a
  precompiled native binding and writes to a local file.

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy the example env file:

```bash
cp .env.example .env
```

This is sufficient to run `npm run dev` / `npm start`. Variables in `.env` are loaded automatically
via `dotenv/config`, imported at the top of `src/config.ts` — no extra setup needed.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port (integer 0–65535) the server listens on |
| `DB_PATH` | `./data/myfood.db` (relative to the process working directory) | Path to the SQLite file. Set to `:memory:` to use the in-memory repository instead (data is lost on restart) |
| `SPOONACULAR_API_KEY` | *(none)* | Required for `/recipes/suggestions`. Missing it only logs a warning at startup — the server still starts, but recipe requests fail at request time. Get a free key at [spoonacular.com/food-api](https://spoonacular.com/food-api) |
| `SPOONACULAR_TIMEOUT_MS` | `8000` | Timeout for the Spoonacular search call (the API key is sent via the `x-api-key` header, never in the URL) |
| `SPOONACULAR_ENRICHMENT_TIMEOUT_MS` | `5000` | Timeout for each per-recipe enrichment call |
| `RECIPE_CACHE_TTL_MS` | `600000` | TTL of cached recipe search results |
| `RECIPE_CACHE_MAX_ENTRIES` | `500` | Max cached recipe searches (integer ≥ 1) |
| `RECIPE_MAX_INGREDIENTS` | `10` | Max ingredients (soonest-expiring first) sent per suggestion search (1–50) |
| `DISPOSED_RETENTION_DAYS` | `365` | Retention for disposed items; a purge job deletes older ones (`0` disables). Bounds history/waste-stats lookback |
| `DISPOSED_PURGE_INTERVAL_MS` | `86400000` | Purge job interval (first run ~60s after start) |
| `EXPIRY_ALERT_DEFAULT_DAYS` | `7` | Default "expiring within N days" window used by `/alerts/expiry` and the shopping summary when no query override is given (integer 0–3650) |
| `NOTIFICATION_POLL_INTERVAL_MS` | `3600000` (1h) | How often the background `NotificationPoller` checks for expiring items (ms, integer 1000–2147483647) |
| `NOTIFICATION_WITHIN_DAYS` | falls back to `EXPIRY_ALERT_DEFAULT_DAYS` | Window used by the notification poller specifically (integer 0–3650) |
| `NOTIFICATION_CHANNELS` | `console` | Comma-separated notification channels: `console`, `webhook` (several = fan-out; any failing channel makes the batch retry) |
| `NOTIFICATION_WEBHOOK_URL` | — | http(s) URL receiving expiry alerts; required when `webhook` is enabled (never logged) |
| `NOTIFICATION_WEBHOOK_SECRET` | — | Optional HMAC-SHA256 signing secret for webhook requests |
| `NOTIFICATION_WEBHOOK_TIMEOUT_MS` | `5000` | Webhook request timeout (ms, integer 1–2147483647) |
| `CORS_ORIGIN` | `*` | Comma-separated list of allowed CORS origins. Defaults to `*` (any origin) for dev convenience; set explicitly in shared/production environments |
| `TRUST_PROXY` | `false` | Express `trust proxy` setting. Set to a hop count (e.g. `1`) when behind a reverse proxy/load balancer so the rate limiter sees the real client IP. Accepts `true`/`false` or a non-negative number |

`DB_PATH`'s parent directory is created automatically via `fs.mkdirSync` in `src/index.ts` on
startup, so `./data/` does not need to be created manually.

## 3. Run the server

```bash
npm run dev
```

This runs `tsx watch src/index.ts`, which restarts the server automatically on file changes. On
startup you should see:

```
[MYFood Service] Listening on port 3000
[MYFood Service] Database: ./data/myfood.db
[MYFood Service] Health: http://localhost:3000/health
```

Confirm the server is up:

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"myfood-service","timestamp":"..."}
```

### Running against an in-memory database

For quick manual testing without touching disk state:

```bash
DB_PATH=:memory: npm run dev
```

Every restart starts from an empty inventory.

### Legacy rows with no `user_id`

If startup fails with `food_items table has N row(s) with no user_id`, run `npm run assign-orphans -- --email <registered user> [--dry-run]` (`src/cli/assign-orphaned-items.ts`; helper in `adapters/outbound/persistence/assign-orphaned-items.ts`). It does not load `config.ts`, so no `JWT_SECRET` is needed, and uses `console.log` deliberately.

## 4. Explore the API

Once running, interactive Swagger UI documentation is available at:

```
http://localhost:3000/api/docs
```

The raw OpenAPI 3.0 spec (generated from the domain Zod schemas) is served at:

```
http://localhost:3000/api/docs.json
```

Core routes (see `src/adapters/inbound/http/router.ts`, mounted under the `/api/v1` prefix in
`app.ts`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check (not versioned, outside `/api/v1`) |
| `POST` | `/api/v1/food-items` | Add a food item |
| `GET` | `/api/v1/food-items` | List items. Filters: `location`, `category`, `name`, `lowStock=true|false`, `expiringBefore=<ISO date>` (inclusive, includes expired; a date-only value means the end of that UTC day), `status=expired|expiring|fresh` (relative to now; `expiring` uses the global `EXPIRY_ALERT_DEFAULT_DAYS` as `now + N×24h` and may differ from `/alerts` for users with a custom `alertWithinDays`). Sort: `sort=bestBefore|name|addedAt|quantity` (default `bestBefore`), `order=asc|desc` (default `asc`; ties broken by id). Pagination: `page` (>=1, default 1), `limit` (1–100, default 20). Response includes `totalPages` (`0` when there are no items). Invalid values return 400 |
| `GET` | `/api/v1/food-items/history` | Disposal history (`?outcome=CONSUMED|DISCARDED&from=&to=&page=&limit=`), newest `disposedAt` first, same paginated envelope |
| `POST` | `/api/v1/food-items/:id/consume` | Consume part of an item: body `{amount}` (> 0). Returns `{item, disposed, lowStock}`; if `amount >= quantity` the item is disposed as `CONSUMED` (`disposed: true`). Partial consumes create no history or stats; only the final full consume counts as a consumed item. Note the response shape differs from `/dispose` |
| `POST` | `/api/v1/food-items/:id/restore` | Restore a disposed item to the active list (404 if not disposed, 409 if an active item with the same name/location exists) |
| `GET` | `/api/v1/stats/waste` | Waste stats from disposal history (`?from=&to=`, default last 90 days): totals (counts items, `wasteRate = discarded/total`, 0 when empty), `byCategory`, `byMonth` (UTC). Bounded by `DISPOSED_RETENTION_DAYS` |
| `GET` | `/api/v1/food-items/:id` | Get a single item |
| `PATCH` | `/api/v1/food-items/:id` | Update an item |
| `DELETE` | `/api/v1/food-items/:id` | Remove an item |
| `GET` | `/api/v1/alerts/expiry` | Items expiring within a window (`?withinDays=`) |
| `GET` | `/api/v1/recipes/suggestions` | Recipe suggestions based on current inventory (requires `SPOONACULAR_API_KEY`) |
| `GET` | `/api/v1/shopping/summary` | Combined "expiring soon" + "low stock" summary |
| `GET` | `/api/v1/shopping/list` | Persisted shopping list (max 500/user) |
| `POST` | `/api/v1/shopping/list` | Add list item (201) |
| `PATCH` | `/api/v1/shopping/list/:id` | Update / tick item |
| `DELETE` | `/api/v1/shopping/list/:id` | Delete item (204) |
| `POST` | `/api/v1/shopping/list/clear-checked` | Delete checked items, returns `{removed}` |
| `POST` | `/api/v1/shopping/list/import` | Import from summary, skipping existing names (201); all-or-nothing against the 500 cap (422, nothing created) |
| `GET` | `/api/v1/food-items/shelf-life` | Advisory shelf-life suggestion (`category`, `location`) |
| `GET` | `/api/v1/food-items/shelf-life/table` | Full default shelf-life table |
| `GET` | `/api/v1/food-items/export` | `format=json\|csv` download; CSV prefixes `'` to cells starting with `=+-@`/tab/CR (alters data slightly; JSON is lossless) |

Example: create an item with `curl`:

```bash
curl -X POST http://localhost:3000/api/v1/food-items \
  -H 'Content-Type: application/json' \
  -d '{"name": "Milk", "location": "fridge", "quantity": 1, "bestBefore": "2026-12-31"}'
```

**Date query params** (`from`, `to`, `expiringBefore`): date-only values are accepted (UTC day semantics above); datetimes must include a timezone (`Z` or an offset), and datetimes without one are rejected with 400. In a URL query string a `+` offset must be encoded as `%2B` (e.g. `2026-11-01T10:00:00%2B02:00`), otherwise it is decoded as a space.

## 5. Running tests

```bash
npm test              # run the full suite once (vitest run)
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
npx vitest run src/adapters/inbound/http/__tests__/food-item.controller.test.ts  # single file
```

Tests are colocated in `__tests__` directories next to the code they cover. HTTP integration tests
use `supertest` against the real Express app (`createApp`, wired via
`src/adapters/inbound/http/__tests__/test-app.ts`) backed by `InMemoryFoodItemRepository` — no
database file is touched, and no real network calls are made (the `RecipeProviderPort` is faked in
tests since Spoonacular is an external dependency).

### Web UI

The frontend lives in `web/` (own `package.json`). With the backend on :3000, run `cd web && npm install && npm run dev` and open http://localhost:5173. Tests: `npm test`; end-to-end: `npm run e2e`. See `web/README.md`.

## 6. Type checking and linting

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src
```

Run both before committing; CI (once added — see `next-steps.md` item 16) will enforce these.

## 7. Debugging

- **VS Code / editor debugger:** attach to the process started by `tsx watch src/index.ts`, or run
  `node --inspect -r tsx/cjs src/index.ts` (adjust as needed) and attach a debugger to port `9229`.
- **Logging:** HTTP requests are logged via `morgan` in dev/production (suppressed automatically when
  `NODE_ENV=test`). To trace a specific request, watch the terminal running `npm run dev`.
- **Database inspection:** since `DB_PATH` points to a plain SQLite file, you can inspect it directly
  with the `sqlite3` CLI or a GUI tool (e.g. `sqlite3 ./data/myfood.db ".tables"`).
- **Resetting local state:** delete the SQLite file to start fresh:
  ```bash
  rm ./data/myfood.db
  ```
  The parent directory and a fresh file will be recreated automatically the next time you start the
  server.

## 8. Building for production

```bash
npm run build   # tsc → dist/
npm start       # node dist/index.js
```

### Running with Docker

See the "Running with Docker" section in the root `README.md` for the multi-stage
`Dockerfile` and `docker-compose.yml` workflow (`docker compose up --build`). Remember
that `JWT_SECRET` must be set in `.env` — the app will refuse to start without it outside
the `test` environment.

## Project structure reference

This project follows a hexagonal (ports & adapters) architecture — see `AGENTS.md` at the repo root
for the full set of architectural conventions before making structural changes. In short:

- `src/core/domain` / `src/core/ports` — framework-free domain types and port interfaces
- `src/application` — use-case services implementing inbound ports, depending only on outbound ports
- `src/adapters/inbound/http` — Express controllers/routes
- `src/adapters/outbound/*` — SQLite persistence, in-memory persistence (used for `:memory:` and
  tests), Spoonacular recipe provider, console notification adapter
- `src/index.ts` — the only place adapters are constructed and wired into services/controllers

## Notifications, settings and favourites

### Webhook payload and signature verification

With `NOTIFICATION_CHANNELS=webhook` each user's unsent alerts are POSTed as JSON (delivery is at-least-once: a failed request is retried on the next poll, and with several channels each channel's delivery is tracked per alert and UTC day (`notifications_sent.channel`, migration 012; `CompositeNotificationAdapter` is given the `NotificationLogPort`), so only the failing channel retries; the poller marks the whole batch (channel `''`) once all channels succeeded). If `NOTIFICATION_WEBHOOK_SECRET` is empty the server warns at startup and payloads are unsigned:

```json
{
  "event": "expiry_alerts",
  "sentAt": "2026-09-01T08:00:00.000Z",
  "user": { "id": "...", "email": "user@example.com" },
  "alerts": [
    { "status": "CRITICAL", "daysUntilExpiry": 1,
      "item": { "id": "...", "name": "Milk", "location": "FRIDGE", "category": "DAIRY",
                "bestBefore": "2026-09-02T00:00:00.000Z", "quantity": 1, "unit": "LITRES" } }
  ]
}
```

If `NOTIFICATION_WEBHOOK_SECRET` is set, requests carry `X-MyFood-Timestamp` (unix seconds) and `X-MyFood-Signature: sha256=<hex>`, the HMAC-SHA256 of `${timestamp}.${rawBody}`. Verify against the raw body and reject stale timestamps:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(rawBody, headers, secret) {
  const ts = headers['x-myfood-timestamp'];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  const got = headers['x-myfood-signature'] ?? '';
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
```

Non-2xx responses, timeouts and redirects count as failures. The URL is operator-configured; DNS/IP (SSRF) filtering is a non-goal until per-user URLs exist.

### User settings, recipe preferences and favourites

- `GET/PUT /api/v1/settings` — `{alertWithinDays (1–365|null), diet|null, intolerances[], channel}`; PUT is a full replace, unknown keys are rejected. `channel` is reserved: it is stored but not yet honoured by the notification poller (which uses `NOTIFICATION_CHANNELS`).
- Alert window precedence: explicit `?withinDays` > user's `alertWithinDays` > `NOTIFICATION_WITHIN_DAYS` (poller) / `EXPIRY_ALERT_DEFAULT_DAYS`.
- When `diet`/`intolerances` are set, `/recipes/suggestions` switches from Spoonacular `findByIngredients` to the costlier `complexSearch` (cached per preference set). Only the 3 most urgent ingredients are sent to `complexSearch`; there is no fallback to `findByIngredients` (which ignores diet/intolerances), so an empty result means no recipes matched the preferences. Recipes using the user's soonest-expiring items (max 3, within the alert window) are ranked first and carry `expiringSoon`; favourites carry `isFavorite: true`.
- `GET /api/v1/recipes/favorites`, `PUT|DELETE /api/v1/recipes/favorites/:recipeId` (idempotent; PUT body `{title, imageUrl?, sourceUrl?}`; DELETE returns 204).
