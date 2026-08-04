# AGENTS.md

## Commands
- `npm run dev` — tsx watch server (entrypoint `src/index.ts`)
- `npm run build` — `tsc` to `dist/`
- `npm test` — `vitest run` (all tests); `npm run test:watch` for watch mode
- Single test file: `npx vitest run path/to/file.test.ts`
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — **broken**: script calls `eslint` but no ESLint config/deps exist in this repo (not installed in `node_modules`, no `.eslintrc*`). Don't rely on it or "fix lint errors" until ESLint is actually added.

## Environment / config gotcha
- `.env` is **not** auto-loaded — there is no `dotenv` dependency, and `src/config.ts` reads `process.env` directly. `cp .env.example .env` alone does nothing for `npm run dev`/`npm start`; env vars must be exported in the shell or the run config, or `dotenv` must be added first.
- `SPOONACULAR_API_KEY` missing only logs a warning at startup (`src/config.ts`); it does not throw. Recipe endpoints will fail at request time instead.
- `DB_PATH` defaults to `./data/myfood.db`; `src/index.ts` creates the parent dir via `fs.mkdirSync` on startup, so no manual setup needed for that file itself.

## Architecture (Hexagonal / Ports & Adapters)
- `src/core/domain` and `src/core/ports` must stay free of infrastructure imports (no express, better-sqlite3, fetch, etc.) — they only reference port interfaces.
- `src/application/*.service.ts` implement inbound port interfaces and depend only on outbound port interfaces (constructor-injected), never on concrete adapters.
- `src/adapters/inbound/http` — Express controllers/router; `src/adapters/outbound/persistence` — SQLite repository; `src/adapters/outbound/recipe-provider` — Spoonacular adapter.
- All wiring (constructing adapters, injecting into services, injecting into controllers) happens only in `src/index.ts`. When adding a new use case, add ports first, then application service, then adapter(s), then wire in `index.ts`.
- There is no in-memory repository adapter yet (see `next-steps.md` item 2) — current tests (`src/application/__tests__`, `src/core/domain/__tests__`) only cover domain/service logic, not HTTP or SQLite persistence directly.

## Module system
- Project uses native ESM (`"type": "module"`, `moduleResolution: NodeNext`). Relative imports within `src/` must use explicit `.js` extensions (e.g. `import { config } from './config.js'`) even though the source files are `.ts`.

## Node version
- Use Node 24 LTS per `.nvmrc` (`nvm use`).

## Roadmap
- `next-steps.md` at repo root tracks a priority-ordered backlog (in-memory repo for tests, HTTP integration tests, pagination, logging, auth, Docker, etc.). Check it before assuming a feature is unimplemented by design vs. simply not-yet-done.
