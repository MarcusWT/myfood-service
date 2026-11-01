# MYFood Service

[![CI](https://github.com/MarcusWT/myfood-service/actions/workflows/ci.yml/badge.svg)](https://github.com/MarcusWT/myfood-service/actions/workflows/ci.yml)

A RESTful API service for tracking food items across Fridge, Freezer, and Pantry locations. Includes expiry date alerts, recipe suggestions, and shopping list summaries.

Built with **Node.js 24 LTS**, **TypeScript**, and **Hexagonal Architecture** for extensibility and ease of maintenance.

---

## Architecture

This service follows the **Hexagonal Architecture** (Ports & Adapters) pattern:

```
src/
├── core/
│   ├── domain/          # Entities, value objects, pure domain logic
│   └── ports/
│       ├── inbound/     # Service interfaces (use case contracts)
│       └── outbound/    # Repository & provider interfaces
├── application/         # Use case implementations
└── adapters/
    ├── inbound/http/    # Express controllers, router, error handler
    └── outbound/
        ├── persistence/ # SQLite repository adapter
        └── recipe-provider/ # Spoonacular API adapter
```

The domain and application layers have **zero infrastructure dependencies** — they depend only on port interfaces, making adapters fully swappable.

---

## Prerequisites

- Node.js 24 LTS (`nvm use` will select the correct version via `.nvmrc`)
- A [Spoonacular API key](https://spoonacular.com/food-api) for recipe suggestions

---

## Setup

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Edit .env and set your SPOONACULAR_API_KEY
```

---

## Running

```bash
# Development (with live reload)
npm run dev

# Production build + start
npm run build
npm start
```

The service starts on port `3000` by default. A health check is available at:

```
GET /health
```

---

## Running with Docker

The service ships with a multi-stage `Dockerfile` and a `docker-compose.yml` for local development.

### Setup

```bash
# Copy environment config if you haven't already
cp .env.example .env

# Edit .env and set JWT_SECRET to a long random value (required — the app
# refuses to start outside the test environment without it) and
# SPOONACULAR_API_KEY if you want recipe suggestions to work.
```

### Build and run

```bash
docker compose up --build
```

This builds the image (build stage runs `npm ci && npm run build`, then prunes
dev dependencies; the production stage copies in the pruned `node_modules` and
compiled `dist/` — no compiler toolchain ships in the final image, and the
container runs as an unprivileged `app` user), starts the container, and maps
the configured `PORT` (default `3000`) to the host.

The SQLite database file is persisted outside the container by bind-mounting `./data`
(on the host) to `/app/data` (in the container) — data survives container restarts and
rebuilds. The compose file also defines a `healthcheck` that polls `GET /health`.
The image sets a default `DB_PATH=/app/data/myfood.db`, so this works even if
`DB_PATH` is omitted from `.env` (unlike running the app outside Docker, where
the default resolves elsewhere and `DB_PATH` should be set explicitly).

### Web UI

`docker compose up --build` also starts a `web` service (nginx serving the SPA
from `web/`, proxying `/api/` to the API) on `WEB_PORT` (default `8080`). The API
container gets `TRUST_PROXY=1`. The nginx proxy targets `myfood-service:3000`, so
keep the API's container `PORT` at 3000. See `web/README.md` for frontend commands.

### Without docker-compose

```bash
docker build -t myfood-service .
docker run -p 3000:3000 \
  -e JWT_SECRET=a-long-random-secret \
  -v "$(pwd)/data:/app/data" \
  myfood-service
```

---

## Upgrading: legacy items with no owner

Databases created before authentication may contain `food_items` rows with no `user_id`. The server refuses to start (`food_items table has N row(s) with no user_id`) rather than leave them silently invisible. Register a user first, then assign the rows to it:

```bash
npm run assign-orphans -- --email you@example.com --dry-run   # preview
npm run assign-orphans -- --email you@example.com             # apply
# built/prod: node dist/cli/assign-orphaned-items.js --email you@example.com
# Docker:     docker compose run --rm myfood-service node dist/cli/assign-orphaned-items.js --email you@example.com
```

It uses `DB_PATH` (default `./data/myfood.db`), is idempotent, and soft-discards (never deletes) orphaned items that duplicate one of the user's active items (same name + location).

## API Reference

All endpoints are prefixed with `/api/v1`.

### Food Items

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/food-items` | Add a new food item |
| `GET` | `/food-items` | List items. Filters: `location`, `category`, `name`, `lowStock=true|false`, `expiringBefore=<ISO date>` (inclusive, includes expired; a date-only value means the end of that UTC day), `status=expired|expiring|fresh` (relative to now; `expiring` uses the global `EXPIRY_ALERT_DEFAULT_DAYS` as `now + N×24h` and may differ from `/alerts` for users with a custom `alertWithinDays`). Sort: `sort=bestBefore|name|addedAt|quantity` (default `bestBefore`), `order=asc|desc` (default `asc`; ties broken by id). Pagination: `page` (>=1, default 1), `limit` (1–100, default 20). Response includes `totalPages` (`0` when there are no items). Invalid values return 400 |
| `GET` | `/food-items/history` | Disposal history (`?outcome=CONSUMED|DISCARDED&from=&to=&page=&limit=`; date-only `from` = start of that UTC day, date-only `to` = end of it), newest `disposedAt` first, same paginated envelope |
| `POST` | `/food-items/:id/consume` | Consume part of an item: body `{amount}` (> 0). Returns `{item, disposed, lowStock}`; if `amount >= quantity` the item is disposed as `CONSUMED` (`disposed: true`). Partial consumes create no history or stats; only the final full consume counts as a consumed item. Note the response shape differs from `/dispose` |
| `POST` | `/food-items/:id/restore` | Restore a disposed item to the active list (404 if not disposed, 409 if an active item with the same name/location exists) |
| `GET` | `/stats/waste` | Waste stats from disposal history (`?from=&to=`, default last 90 days; date-only `to` = end of that UTC day): totals (counts items, `wasteRate = discarded/total` rounded to 4 decimals, 0 when empty), `byCategory`, `byMonth` (UTC). Bounded by `DISPOSED_RETENTION_DAYS` |
| `GET` | `/food-items/:id` | Get a single item |
| `PATCH` | `/food-items/:id` | Update an item (partial; send `null` for `notes`/`minimumQuantity` to clear them; `bestBefore` must be a future date only if changed) |
| `DELETE` | `/food-items/:id` | Remove an item |

**Create body example:**

```json
{
  "name": "Whole Milk",
  "quantity": 2,
  "unit": "LITRES",
  "location": "FRIDGE",
  "category": "DAIRY",
  "bestBefore": "2026-08-12",
  "notes": "Full fat"
}
```

**`bestBefore`:** ISO 8601 datetime with timezone, or a date-only `YYYY-MM-DD` which is interpreted as **UTC midnight**. On create it must be in the future, so a date-only value for today (already past UTC midnight) is rejected; send a datetime later today instead.

**Enums:**

- `location`: `FRIDGE` | `FREEZER` | `PANTRY`
- `category`: `DAIRY` | `MEAT` | `SEAFOOD` | `VEGETABLES` | `FRUITS` | `GRAINS` | `CONDIMENTS` | `BEVERAGES` | `SNACKS` | `FROZEN` | `OTHER`
- `unit`: `GRAMS` | `KILOGRAMS` | `MILLILITRES` | `LITRES` | `UNITS` | `SLICES` | `PORTIONS`

---

**Date query params** (`from`, `to`, `expiringBefore`): date-only values are accepted (UTC day semantics above); datetimes must include a timezone (`Z` or an offset), and datetimes without one are rejected with 400. In a URL query string a `+` offset must be encoded as `%2B` (e.g. `2026-11-01T10:00:00%2B02:00`), otherwise it is decoded as a space.

### Expiry Alerts

```
GET /api/v1/alerts/expiry?withinDays=7
```

Returns all items expiring within the specified number of days (default: 7), including already-expired items. Each alert includes a `status`:

- `EXPIRED` — past best before date
- `CRITICAL` — 0–2 days remaining
- `WARNING` — 3–5 days remaining
- `UPCOMING` — 6+ days remaining

---

### Recipe Suggestions

```
GET /api/v1/recipes/suggestions?limit=5
```

Returns recipe suggestions from the Spoonacular API based on non-expired items currently in stock. Each recipe includes `usedIngredients`, `missedIngredients`, and a `matchScore` (percentage of available ingredients used).

---

### Shopping Summary

```
GET /api/v1/shopping/summary
```

Returns a shopping list summary grouped by category. Includes items that are expired or expiring within 3 days. It is derived and stateless; the persisted list below is separate.

### Persisted shopping list

All routes require auth; lists are per user (max 500 items; exceeding returns 422).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/shopping/list` | List items |
| `POST` | `/api/v1/shopping/list` | Add `{name, quantity?, unit?, category?}` (201) |
| `PATCH` | `/api/v1/shopping/list/:id` | Update fields or tick/untick with `{checked}` |
| `DELETE` | `/api/v1/shopping/list/:id` | Delete (204) |
| `POST` | `/api/v1/shopping/list/clear-checked` | Delete checked items, returns `{removed}` |
| `POST` | `/api/v1/shopping/list/import` | Add items from the shopping summary, skipping names already listed (201); all-or-nothing: 422 and nothing added if it would exceed the 500-item cap |

Ticking an item does not touch inventory.

### Shelf-life suggestions

`GET /api/v1/food-items/shelf-life?category=DAIRY&location=FRIDGE` returns `{category, location, days, suggestedBestBefore, source}` from a static default table (`days`/`suggestedBestBefore` are `null` when the combination isn't recommended). `GET /api/v1/food-items/shelf-life/table` returns the whole table. Advisory only: `bestBefore` is still required when creating items.

### Export

`GET /api/v1/food-items/export?format=json|csv` (default `json`) downloads all active items as an attachment. JSON (`{exportedAt, count, items}`) is the lossless format. In CSV, text cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading `'` to prevent spreadsheet formula injection, so those values (also ones with leading spaces, e.g. `" =x"`) differ slightly from the stored data; JSON export is lossless.


### Webhook payload and signature verification

With `NOTIFICATION_CHANNELS=webhook` each user's unsent alerts are POSTed as JSON (delivery is at-least-once: a failed request is retried on the next poll, and with several channels each channel's delivery is tracked per alert and UTC day, so only the failing channel retries). If `NOTIFICATION_WEBHOOK_SECRET` is empty the server warns at startup and payloads are unsigned:

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

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port (integer 0–65535) |
| `DB_PATH` | `./data/myfood.db` (relative to the process working directory) | SQLite database file path |
| `SPOONACULAR_API_KEY` | — | Required for recipe suggestions |
| `SPOONACULAR_TIMEOUT_MS` | `8000` | Timeout for the Spoonacular search call (the API key is sent via the `x-api-key` header, never in the URL) |
| `SPOONACULAR_ENRICHMENT_TIMEOUT_MS` | `5000` | Timeout for each per-recipe enrichment call |
| `RECIPE_CACHE_TTL_MS` | `600000` | TTL of cached recipe search results |
| `RECIPE_CACHE_MAX_ENTRIES` | `500` | Max cached recipe searches (integer ≥ 1) |
| `RECIPE_MAX_INGREDIENTS` | `10` | Max ingredients (soonest-expiring first) sent per suggestion search (1–50) |
| `EXPIRY_ALERT_DEFAULT_DAYS` | `7` | Default alert window in days (integer 0–3650) |
| `DISPOSED_RETENTION_DAYS` | `365` | Disposed (consumed/discarded) items older than this are purged by a daily job; `0` disables purging. Bounds how far back history and `/stats/waste` can look |
| `DISPOSED_PURGE_INTERVAL_MS` | `86400000` | How often the purge job runs (first run ~60s after start) |
| `JWT_SECRET` | — | **Required** outside the `test` environment; the app throws at startup if unset |
| `JWT_EXPIRES_IN` | `24h` | JWT token expiry |
| `LOG_LEVEL` | `info` | pino log level (`silent` forced in `test` env) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (ms, integer 1–2147483647) for the general `/api/v1` limiter |
| `RATE_LIMIT_MAX` | `200` | Max requests per window per IP (integer ≥ 1) for all `/api/v1` routes |
| `AUTH_RATE_LIMIT_MAX` | `10` | Max requests per window per IP (integer ≥ 1) for `/auth/register` and `/auth/login` |
| `RECIPE_RATE_LIMIT_MAX` | `20` | Max requests per window per IP (integer ≥ 1) for `/recipes/suggestions` (proxies the metered Spoonacular API) |
| `BODY_LIMIT` | `100kb` | Max JSON request body size |
| `NOTIFICATION_POLL_INTERVAL_MS` | `3600000` (1h) | How often the background `NotificationPoller` checks for expiring items (ms, integer 1000–2147483647) |
| `NOTIFICATION_WITHIN_DAYS` | falls back to `EXPIRY_ALERT_DEFAULT_DAYS` | Window used by the notification poller specifically (integer 0–3650) |
| `NOTIFICATION_CHANNELS` | `console` | Comma-separated notification channels: `console`, `webhook` (several = fan-out; any failing channel makes the batch retry) |
| `NOTIFICATION_WEBHOOK_URL` | — | http(s) URL receiving expiry alerts; required when `webhook` is enabled (never logged) |
| `NOTIFICATION_WEBHOOK_SECRET` | — | Optional HMAC-SHA256 signing secret for webhook requests |
| `NOTIFICATION_WEBHOOK_TIMEOUT_MS` | `5000` | Webhook request timeout (ms, integer 1–2147483647) |
| `CORS_ORIGIN` | `*` | Comma-separated list of allowed CORS origins. Defaults to `*` (any origin) for dev convenience; set explicitly in shared/production environments |
| `TRUST_PROXY` | `false` | Express `trust proxy` setting. Set to a hop count (e.g. `1`) when behind a reverse proxy/load balancer so the rate limiter sees the real client IP. Accepts `true`/`false` or a non-negative number |

Rate limiting is automatically disabled in the `test` environment (`NODE_ENV=test`) so the HTTP integration test suite isn't affected by its own rapid sequential requests.

---

## Testing

```bash
# Run tests once
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

---

## Type Checking

```bash
npm run typecheck
```
