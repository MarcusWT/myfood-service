# AGENTS.md

## Commands
- `npm run dev` — tsx watch server (entrypoint `src/index.ts`)
- `npm run build` — `tsc` to `dist/`
- `npm test` — `vitest run` (all tests); `npm run test:watch` for watch mode
- Single test file: `npx vitest run path/to/file.test.ts`
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — runs `eslint src` using `eslint.config.js` (flat config, `typescript-eslint`); passes clean as of this writing.

## Environment / config
- `.env` is auto-loaded via `dotenv/config` imported at the top of `src/config.ts` (`dotenv` is a real dependency). `cp .env.example .env` is sufficient for `npm run dev`/`npm start`.
- `SPOONACULAR_API_KEY` missing only logs a warning at startup (`src/config.ts`); it does not throw. Recipe endpoints will fail at request time instead.
- `DB_PATH` defaults to `./data/myfood.db`; `src/index.ts` creates the parent dir via `fs.mkdirSync` on startup, so no manual setup needed for that file itself.

## Architecture (Hexagonal / Ports & Adapters)
- `src/core/domain` and `src/core/ports` must stay free of infrastructure imports (no express, better-sqlite3, fetch, etc.) — they only reference port interfaces.
- `src/application/*.service.ts` implement inbound port interfaces and depend only on outbound port interfaces (constructor-injected), never on concrete adapters.
- `src/adapters/inbound/http` — Express controllers/router; `src/adapters/outbound/persistence` — SQLite repository; `src/adapters/outbound/recipe-provider` — Spoonacular adapter.
- All wiring (constructing adapters, injecting into services, injecting into controllers) happens only in `src/index.ts`. When adding a new use case, add ports first, then application service, then adapter(s), then wire in `index.ts`.
- `InMemoryFoodItemRepository` (`src/adapters/outbound/persistence/food-item.in-memory.repository.ts`) implements `FoodItemRepositoryPort` and is used both as the `DB_PATH=:memory:` fallback in `src/index.ts` and as the backing repository for HTTP integration tests (see below). SQLite persistence itself is still untested directly.
- HTTP integration tests exist under `src/adapters/inbound/http/__tests__` using `supertest` against the real app built via `createApp` (see `test-app.ts` helper), wired to `InMemoryFoodItemRepository` and real application services — no mocking at the HTTP layer except for the `RecipeProviderPort` (Spoonacular), which is faked since it's an external HTTP dependency.

## Module system
- Project uses native ESM (`"type": "module"`, `moduleResolution: NodeNext`). Relative imports within `src/` must use explicit `.js` extensions (e.g. `import { config } from './config.js'`) even though the source files are `.ts`.

## Node version
- Use Node 24 LTS per `.nvmrc` (`nvm use`).

## Roadmap
- `next-steps.md` at repo root tracks a priority-ordered backlog. Items 1–3 (dev setup, in-memory repo, HTTP integration tests) are done; remaining open items are pagination, logging, stricter validation, recipe enrichment, low-stock tracking, notifications, OpenAPI docs, auth, and containerisation. Check it before assuming a feature is unimplemented by design vs. simply not-yet-done.
