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
| `PORT` | `3000` | HTTP port the server listens on |
| `DB_PATH` | `./data/myfood.db` | Path to the SQLite file. Set to `:memory:` to use the in-memory repository instead (data is lost on restart) |
| `SPOONACULAR_API_KEY` | *(none)* | Required for `/recipes/suggestions`. Missing it only logs a warning at startup — the server still starts, but recipe requests fail at request time. Get a free key at [spoonacular.com/food-api](https://spoonacular.com/food-api) |
| `EXPIRY_ALERT_DEFAULT_DAYS` | `7` | Default "expiring within N days" window used by `/alerts/expiry` and the shopping summary when no query override is given |
| `NOTIFICATION_POLL_INTERVAL_MS` | `3600000` (1h) | How often the background `NotificationPoller` checks for expiring items |
| `NOTIFICATION_WITHIN_DAYS` | falls back to `EXPIRY_ALERT_DEFAULT_DAYS` | Window used by the notification poller specifically |
| `CORS_ORIGIN` | `*` | Comma-separated list of allowed CORS origins. Defaults to `*` (any origin) for dev convenience; set explicitly in shared/production environments |
| `TRUST_PROXY` | `false` | Express `trust proxy` setting. Set to a hop count (e.g. `1`) when behind a reverse proxy/load balancer so the rate limiter sees the real client IP |

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
| `GET` | `/api/v1/food-items` | List food items (paginated: `?page=&limit=`) |
| `GET` | `/api/v1/food-items/:id` | Get a single item |
| `PATCH` | `/api/v1/food-items/:id` | Update an item |
| `DELETE` | `/api/v1/food-items/:id` | Remove an item |
| `GET` | `/api/v1/alerts/expiry` | Items expiring within a window (`?withinDays=`) |
| `GET` | `/api/v1/recipes/suggestions` | Recipe suggestions based on current inventory (requires `SPOONACULAR_API_KEY`) |
| `GET` | `/api/v1/shopping/summary` | Combined "expiring soon" + "low stock" summary |

Example: create an item with `curl`:

```bash
curl -X POST http://localhost:3000/api/v1/food-items \
  -H 'Content-Type: application/json' \
  -d '{"name": "Milk", "location": "fridge", "quantity": 1, "bestBefore": "2026-12-31"}'
```

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
