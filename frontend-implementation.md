# MYFood Service: Frontend Implementation Plan and Remaining Backlog

Continues from `next-steps.md` (items 1–18 complete). This file holds the frontend plan plus the backend backlog items that were still open.

## Decisions
- `web/` directory in this repo, as a standalone package. The backend stays at the root.
- React with strict TypeScript.
- Same-origin deployment: nginx serves the SPA and proxies `/api` to Express. No CORS needed, and `TRUST_PROXY=1` is set on the API.
- Backend changes are limited to what the UI needs. Logout is client-side only.

---

## Phase 0: Backend changes needed by the UI
- [x] **`GET /api/v1/auth/me`** returns `{id, email}`. Add port, service method, controller, OpenAPI registration and HTTP integration tests. The UI uses it to validate a stored token on load.
- [x] **Consumed vs discarded status**
  - New numbered, idempotent migration adding a disposition field and timestamp. Keep the row and mark it disposed.
  - New endpoint `POST /food-items/:id/dispose` with `{outcome: CONSUMED|DISCARDED}`.
  - `DELETE` stays a hard delete.
  - Active listings, alerts, shopping summary and recipes exclude disposed items.
  - Update both the SQLite and in-memory repositories, OpenAPI and tests.
- [x] **Docs fix:** AGENTS.md says `/shopping-summary`, but the real route is `/shopping/summary`. Also document the new endpoints and the `web/` commands. (Done; `web/` commands added to AGENTS.md in Phase 1.)

Follow the hexagonal order: ports, then service, then adapters, then wiring in `src/index.ts`. Lint, typecheck and tests must pass.

**Status: complete** (208 backend tests passing).
- `/auth/me`: `AuthServicePort.getCurrentUser`, `AuthController.me`, 401 if the user no longer exists.
- Dispose: migration `005-add-disposition.ts` (nullable `disposition`, `disposed_at`; NULL = active). `FoodItem` gained optional `disposition`/`disposedAt`, omitted from create/update schemas. `FoodItemRepositoryPort.dispose` returns null if missing, foreign or already disposed (-> 404). Reads filter `disposition IS NULL`; `delete` is unfiltered.

## Phase 1: Scaffold `web/`
- [x] Vite, React, strict TypeScript, ESLint (`typescript-eslint`, `react-hooks`, `jsx-a11y`), Prettier.
- [x] Tailwind and shadcn/ui, Vitest with React Testing Library, MSW. (MSW installed; handlers come with Phase 2 tests.)
- [x] Vite dev proxy forwarding `/api` to the backend (confirm port from `src/config.ts`).
- [x] `openapi:generate` script using `openapi-typescript` against `/api/docs.json`. Commit the generated types. (`web/src/api/schema.d.ts`, includes `/auth/me` and dispose.)
- [x] Separate CI job for `web/`: lint, typecheck, test, build. The backend job is left alone.

**Phase 1 status: complete.** Lint, typecheck, test, build and prettier all pass in `web/`. Notes:
- Versions: React 19, Vite 8, Vitest 5, Tailwind 4, zod 4, `openapi-fetch` 0.17. Pinned `eslint@9` and `typescript@5.9` for plugin peer-dependency compatibility.
- shadcn style `base-nova`, alias `@/` -> `web/src`. Only `button` added so far.
- Root `vitest.config.ts` now has `include: ['src/**/*.test.ts']`; `.dockerignore` excludes `web`.
- `msw` has a postinstall script npm flags as not yet approved; harmless unless needed (`npm approve-scripts`).

## Phase 2: API layer and auth
- [x] `openapi-fetch` client with middleware that attaches the bearer token and normalises errors into `ApiError` (status, message, field issues).
- [x] A 401 clears the session and redirects to login with a return URL.
- [x] `AuthProvider` keeps the token in `sessionStorage` and validates it with `/auth/me`.
- [x] Protected routes, login and register forms, a friendly 429 message, and logout.

**Phase 2 status: complete** (9 web tests: redirect, login, 401/429/400 handling, token validation, logout, `safeNext`). Notes:
- `src/api/client.ts`: `openapi-fetch` with base URL `${origin}/api/v1` (schema paths are relative to it). Middleware attaches the bearer token and throws `ApiError` (`src/api/errors.ts`: `status`, `message`, `issues[{path,message}]` from Zod `details`; 429 gets a fixed friendly message). `fetch` is resolved lazily so MSW can intercept in tests.
- A 401 from any endpoint except `/auth/login` and `/auth/register` calls `emitUnauthorized()` (`src/auth/session.ts`); `AuthProvider` listens and clears the session. `RequireAuth` then redirects to `/login?next=<path>`; `safeNext` only accepts same-app relative paths (no open redirect).
- `AuthProvider` keeps the token in `sessionStorage` (`myfood.token`) and validates it with `/auth/me` on load; any failure there (401, network, 5xx) ends the session.
- Pages: `AuthForm` (login/register, RHF + Zod, 400 `details` mapped to fields), placeholder `HomePage` with logout. Routes in `App.tsx`; `BrowserRouter` is in `main.tsx` so tests use `MemoryRouter` (`src/test/render.tsx`).
- Test setup: MSW server in `src/test/server.ts`, `onUnhandledRequest: 'error'`, jsdom origin is `http://localhost:3000`.
- shadcn CLI quirks (v-current): it writes to a literal `web/@/` dir (move files into `src/`) and generated `utils.ts` re-exporting from a third-party `cn` package. Replaced with the standard `clsx` + `tailwind-merge` helper. Check both after every `shadcn add`. Components added: button, input, label, card. `label.tsx` has a targeted eslint-disable for `label-has-associated-control`.

## Phase 3: Inventory
- [x] TanStack Query, with filters (location, category, name) and page in URL search params.
- [x] List (single responsive DOM: stacked card on mobile, row on desktop; not a literal `<table>`), debounced search, server-side pagination.
- [x] Create and edit dialogs with React Hook Form and Zod. Map 400 `details` to field errors, show a duplicate message on 409, and handle the future-only `bestBefore` rule.
- [x] Row actions: Consumed, Discarded, Remove (hard delete), each with confirmation.
- [x] Low-stock and expiry badges that use text and icons, not colour alone.

**Phase 3 status: complete** (16 web tests total, 7 for inventory). Notes:
- `src/inventory/`: `api.ts` (TanStack Query hooks; mutations invalidate `food-items`, `alerts`, `shopping` keys for Phase 4), `InventoryPage` (filters/search/page live in URL params; 300ms debounced name search resets page), `ItemRow` (actions with `AlertDialog` confirmation, status badges with icon + text), `ItemFormDialog` (create/edit).
- Form values are strings converted on submit. `bestBefore` is sent as end of the chosen local day so "today" counts as future. On edit it is only sent if changed (API rejects past dates). 409 -> error on the name field; 400 `details` mapped to fields.
- Native `<select>` is used for forms/filters (simpler and more accessible than the Base UI select); `Select`/`Table` shadcn components were added but are unused.
- `QueryClientProvider` is in `main.tsx` and `src/test/render.tsx`. `AppLayout` provides the header/logout; `HomePage` removed. Test fixtures in `src/test/fixtures.ts`.
- `shadcn add` overwrote `button.tsx` with the bad `cn` import again; re-fixed. Always re-run the checks from the Phase 2 note.

## Phase 4: Alerts, shopping and dashboard
- [x] Expiry alerts with a `withinDays` selector.
- [x] Shopping summary grouped by category, with a copy-as-text action.
- [x] Dashboard with counts and teasers.

**Phase 4 status: complete** (19 web tests). `src/overview/`: `api.ts`, `AlertsPage` (`withinDays` in URL, status icon + text), `ShoppingPage`, `DashboardPage`. Routes: `/` dashboard, `/inventory`, `/alerts`, `/shopping`; nav in `AppLayout`.

## Phase 5: Recipes
- [x] Fetch on demand, not on page load (20 requests per 15 minutes limit).
- [x] Distinct states: loading, no items, unavailable (500), rate-limited (429).
- [x] External URLs limited to `http`/`https`, with `rel="noopener noreferrer"`.

**Phase 5 status: complete** (24 web tests). `src/recipes/RecipesPage.tsx` at `/recipes`: button-triggered `useMutation`, `safeUrl` filters link/image URLs, empty result shows a "no recipes" state.

## Phase 6: Polish
- [x] Accessibility pass with axe, dark mode, responsive layout, error boundary, 404 page, offline banner.

**Phase 6 status: complete** (33 web tests). `src/shell/`: `ErrorBoundary` (wraps `App`), `NotFoundPage` (catch-all route, outside the layout), `OfflineBanner` (`navigator.onLine`), `ThemeToggle` (`.dark` class on `<html>`, persisted in `localStorage`, shown in the app header only). `axe-core` runs in tests on inventory, alerts, shopping, recipes and login with no violations; the `color-contrast` rule is disabled because jsdom can't compute it, so check contrast manually in a browser (Playwright/axe in Phase 7 could cover it).

## Phase 7: E2E and deployment
- [x] Playwright against the real backend with `DB_PATH=:memory:`. Flows: register, add item, see alert, mark consumed, logout. Stub the Spoonacular path.
- [x] Multi-stage `web/Dockerfile` (build, then nginx) with `/api` proxy, SPA fallback and CSP (`connect-src 'self'`).
- [x] Add the nginx service to `docker-compose.yml` and set `TRUST_PROXY=1` on the API.
- [x] Docs: `web/README.md`, root README, `docs/dev/developer-guide.md`, AGENTS.md.

**Phase 7 status: complete.** The e2e flow passes locally and the web image builds. The recipes path isn't exercised in e2e (Spoonacular is never called), so no stub was needed. nginx proxies to `myfood-service:3000` (hard-coded port).

## Risks and notes
- A token in `sessionStorage` is exposed to XSS. Mitigate with a strict CSP and no `dangerouslySetInnerHTML`.
- Tokens can't be revoked, so logout only discards the token client-side.
- The disposal migration must be additive. Never edit existing migrations.
- Real recipe results need `SPOONACULAR_API_KEY`.

---

## Remaining backend backlog (moved from `next-steps.md` item 18)

Items not required for the UI. Deferred.

- **[High, product]** Bulk add (`POST /food-items/bulk`) with per-item partial-failure semantics, not all-or-nothing.
- **[High, product]** Real notification delivery. `NotificationPort`/`NotificationPoller` exist, but the only adapter logs to server stdout. Needs at least an email adapter (the `users` table already has `email`).
- **[Medium, product]** Household/multi-user sharing. The model is strictly single-user (`user_id` per item). Touches nearly every repository method signature.
- **[Medium, product]** Rest of account self-service: `PATCH`/`DELETE /auth/me` (change password, delete account). `GET /auth/me` is covered by Phase 0. Needs token revocation solved alongside it (see item 11's known limitation).
- **[Medium, product]** Token revocation and a logout endpoint (e.g. a token version on the user row checked by the auth middleware).
- **[Medium, product]** Barcode/UPC lookup on item creation (e.g. Open Food Facts), mirroring the `RecipeProviderPort` outbound-adapter pattern.
- **[Medium, ops]** Request/correlation-ID support: assign `req.id`, thread it through morgan and a per-request pino child logger.
- **[Low, ops]** `/metrics` (Prometheus-style) endpoint.
- **[Low, architecture]** Single SQLite file has no multi-instance story. Write an ADR: stay single-instance by design, or plan a Postgres migration.
- **[Low, dependency hygiene]** Major upgrades: `express` 4→5, `zod` 3→4, `better-sqlite3` 11→13, `vitest` 2→5. Plan `express` and `zod` deliberately.
- **[Low, CI]** Upload `vitest` coverage as a build artifact (`test:coverage` exists but isn't wired into the workflow).

## Tier 3 notes: loading, empty states, dashboard, recipes, shopping

- **Loading states**: use `Skeleton` (`components/ui/skeleton.tsx`) inside `LoadingRegion` (`components/LoadingSkeleton.tsx`, `role="status" aria-busy`, sr-only label, decorative children aria-hidden). Skeleton files: `overview/AlertsListSkeleton`, `overview/ShoppingListSkeleton`, `recipes/RecipesSkeleton`; dashboard stat values use an inline `Skeleton`.
- **Empty states**: `EmptyState` is only shown once data has loaded successfully and is empty (never while loading or on error); title is plain text, optional CTA (link via `to`). Error states stay as `role="alert"` text.
- **Dashboard data sources** (existing endpoints only): "Items in stock" and the per-location breakdown come from `useLocationCounts()` (one `GET /food-items?location=X&page=1&limit=1` per location, reading `total`, keys `['food-items','count',location]`); alerts from `/alerts/expiry?withinDays=3`; "Running low" is `LOW_STOCK` entries of `/shopping/summary`. Each section handles its own error with Retry. Follow-up: replace the 3 count requests (and a real low-stock list) with a stats endpoint once the backend offers one (backend item 28).
- **Recipes cache**: `useRecipeSuggestions()` is a disabled query (`['recipes',{limit:10}]`, staleTime 5 min, gcTime 30 min, no retry) triggered by the button via `refetch()`; results survive navigation, a failed refresh keeps the previous results plus an alert. The auth layer clears the query cache on logout.
- **Shopping checklist**: ticks live in `localStorage` under `myfood.shopping.checked.<userId>` (JSON string[] of `category|name|reason` keys). Keys are per user and intentionally NOT cleared on logout; stale keys are pruned only after a successful load. Copy/Share use unchecked items (all if everything is checked).

## Tier 3 notes: inventory polish

- **Selects**: use `NativeSelect` (`components/ui/native-select.tsx`) for all selects (form + filters), not a raw `<select>`.
- **Dialogs**: `ItemFormDialog({item?, open, onOpenChange})` is always mounted by its parent with controlled `open` (so exit animations run); the inner form remounts per open and the last item is retained while closing. Closing/Cancel are blocked while submitting. `ItemList` owns one form dialog and one `ItemActionDialog` for all rows.
- **Toasts** (`sonner`, `lib/toast.ts`, `<Toaster />` in `App.tsx`) live in the mutation hooks in `inventory/api.ts`. Undo: update (PATCHes previous values; skipped if bestBefore changed) and remove (re-POSTs the item only if its bestBefore is still in the future; new id/timestamps). Dispose has NO Undo (no restore endpoint). The item form passes `quietErrors` so field-mapped 400/409 stay inline.
- **Filters**: `useInventoryFilters` (URL params, debounced search via `hooks/useDebouncedValue`, page reset on filter change, chips, clear) + `components/Pagination` (`getPageRange`).
- **Deferred**: sort, low-stock and expiring-before filters need backend item 28; no such controls exist yet.

## Tier 3 notes: shell, theme, visual system, accessibility, hygiene

- **App shell** (`pages/AppLayout.tsx`): skip link, `OfflineBanner`, sticky blurred header (`print:hidden`), desktop `nav[aria-label=Main]`, mobile `Sheet` nav (`aria-label=Mobile`, closes on route change), account dropdown (email, theme radio items, Log out), and the single `<main id="main-content" tabIndex={-1}>` (`MAIN_CONTENT_ID` in `shell/constants.ts`). Pages must NOT render their own `<main>`: root `<div className="space-y-4">` plus `PageHeader` (`shell/PageHeader.tsx`, `title`/`description`/`actions`). Pages outside the layout (login, 404, boundary fallbacks) render their own `<main id="main-content">`.
- **Theme**: `shell/useTheme.ts` (`{theme, resolvedTheme, setTheme}`, module-level store + `useSyncExternalStore`, storage event and `matchMedia` listeners, no provider) over `shell/theme.ts`. Choices persist under `myfood.theme` (`light`/`dark`; "system" removes the key). `public/theme-init.js` is a classic synchronous script in `<head>` that applies the class, `color-scheme` and `#theme-color` before first paint; it is an external file because the nginx CSP forbids inline scripts, and must be kept in sync with `theme.ts`. Status colours are the `--warning`/`--success` token pairs (each fg/bg pair >= 4.5:1).
- **Visual system**: green primary (hue 150) plus tinted neutrals, `--shadow-card`/`--shadow-card-hover`. `Card` takes `interactive` (hover shadow, lift under `motion-safe`, focus ring when it contains a focused link). Use `components/StatCard.tsx` (`label`, `value`, `icon`, `tone`, optional `to`/`hint`) for dashboard-style tiles.
- **Accessibility contract**: `RouteAnnouncer` (in `App.tsx`, sibling of `<Routes>`) sets `document.title` to `<Route title> · MYFood` from a static map, announces "Navigated to …" in a polite live region, and focuses `#main-content` on pathname changes only (not first mount, not search-param changes). `FormError` (`components/form-error.tsx`) is the `role=alert` field/form error; `lib/focusFirstInvalid.ts` focuses the first `[aria-invalid=true]` after server-side errors. `index.css` ends with the `prefers-reduced-motion` and `pointer: coarse` (44px targets) rules. Unit axe helper: `test/axe.ts` (colour contrast disabled in jsdom); real contrast is checked by `e2e/a11y.spec.ts` (`@axe-core/playwright`, wcag2a/2aa/21aa).
- **Dates and expiry**: `lib/date.ts` (`formatDate`, `formatDateTime`, `toIsoEndOfDay`, `toDateInput`) and `lib/expiry.ts` (`daysUntil`, `expiryState`, `expiryText`, `statusText`, `EXPIRING_SOON_DAYS`) are the single source; `inventory/constants.ts` and `overview/AlertsPage.tsx` only re-export.
- **Routes, errors, 401 policy**: page routes are `lazy()` under a top-level `Suspense` (`shell/PageFallback.tsx`); `RouteOutlet` = `RouteErrorBoundary` (reset on pathname) + `Suspense` + `Outlet`, so a crashing page keeps the nav. `ErrorBoundary` has `resetKey`, `variant`, "Try again"/"Reload page" and a chunk-load message. `api/client.ts` emits `unauthorized` only for non-auth paths (`isPublicAuthPath`) when the request carried a token that still equals the current one. `AuthProvider`: only a 401 from `/auth/me` clears the session; network/5xx gives status `error` ("Can't reach the server" + Retry). Session expiry navigates to `/login` with `state={{expired:true}}` (notice on the form); logout and expiry clear the React Query cache.
- **E2E**: Playwright projects `desktop-chromium` and `mobile-chromium` (Pixel 7); use `e2e/helpers.ts` `goTo()` to navigate (opens the mobile menu when needed).
