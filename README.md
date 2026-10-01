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

## API Reference

All endpoints are prefixed with `/api/v1`.

### Food Items

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/food-items` | Add a new food item |
| `GET` | `/food-items` | List items (filter: `?location=FRIDGE&category=DAIRY&name=milk`) |
| `GET` | `/food-items/:id` | Get a single item |
| `PATCH` | `/food-items/:id` | Update an item |
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

**Enums:**

- `location`: `FRIDGE` | `FREEZER` | `PANTRY`
- `category`: `DAIRY` | `MEAT` | `SEAFOOD` | `VEGETABLES` | `FRUITS` | `GRAINS` | `CONDIMENTS` | `BEVERAGES` | `SNACKS` | `FROZEN` | `OTHER`
- `unit`: `GRAMS` | `KILOGRAMS` | `MILLILITRES` | `LITRES` | `UNITS` | `SLICES` | `PORTIONS`

---

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

Returns a shopping list summary grouped by category. Includes items that are expired or expiring within 3 days.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `./data/myfood.db` | SQLite database file path |
| `SPOONACULAR_API_KEY` | — | Required for recipe suggestions |
| `EXPIRY_ALERT_DEFAULT_DAYS` | `7` | Default alert window in days |
| `JWT_SECRET` | — | **Required** outside the `test` environment; the app throws at startup if unset |
| `JWT_EXPIRES_IN` | `24h` | JWT token expiry |
| `LOG_LEVEL` | `info` | pino log level (`silent` forced in `test` env) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (ms) for the general `/api/v1` limiter |
| `RATE_LIMIT_MAX` | `200` | Max requests per window per IP for all `/api/v1` routes |
| `AUTH_RATE_LIMIT_MAX` | `10` | Max requests per window per IP for `/auth/register` and `/auth/login` |
| `RECIPE_RATE_LIMIT_MAX` | `20` | Max requests per window per IP for `/recipes/suggestions` (proxies the metered Spoonacular API) |
| `BODY_LIMIT` | `100kb` | Max JSON request body size |
| `NOTIFICATION_POLL_INTERVAL_MS` | `3600000` (1h) | How often the background `NotificationPoller` checks for expiring items |
| `NOTIFICATION_WITHIN_DAYS` | falls back to `EXPIRY_ALERT_DEFAULT_DAYS` | Window used by the notification poller specifically |
| `CORS_ORIGIN` | `*` | Comma-separated list of allowed CORS origins. Defaults to `*` (any origin) for dev convenience; set explicitly in shared/production environments |
| `TRUST_PROXY` | `false` | Express `trust proxy` setting. Set to a hop count (e.g. `1`) when behind a reverse proxy/load balancer so the rate limiter sees the real client IP |

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
