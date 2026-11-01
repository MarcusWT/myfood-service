# Current Work

Collated from three read-only reviews: backend (BE), frontend (FE) and system health (HEALTH). Items are ranked by impact, risk and effort, and quick wins come first within each tier. Where reviews overlapped, the items are merged and the sources are noted.

Caveat: none of these findings were reproduced at runtime. Typecheck, lint and 208 backend tests were clean at review time. Web tests and e2e were not run. Verify each item before fixing it.

Effort: S = under half a day, M = 1-2 days, L = more than 2 days.

---

## Tier 1: Correctness and security bugs (do first) — items 1-7 DONE

### 1. Malformed JSON returns 500 instead of 400 (S) — DONE
- Source: BE 23.
- `error-handler.ts` special-cases `entity.too.large` but not body-parser's `entity.parse.failed`. Client mistakes are logged at error level.
- Also validate `:id` as a uuid in `food-item.controller.ts` so garbage IDs return 400/404 without a DB query.

### 2. JWT hardening (S) — DONE
- Sources: HEALTH 4, BE 9.
- `auth.service.ts` `verifyToken` should pin `algorithms: ['HS256']` and check that `payload.sub` is a string. Optionally add `issuer`/`audience`.
- Follow-up (M): a `token_version` or `password_changed_at` claim so tokens can be revoked and deleted users are rejected on every route. This is a prerequisite for account self-service.

### 3. Duplicate-item and duplicate-email races (M) — DONE
- Sources: HEALTH 1, BE 5, BE 11.
- Both `register` and add/update item are check-then-insert. Concurrent duplicate emails surface as a 500 instead of a 409.
- Fix:
  - Add migration 006 with a partial unique index on `food_items(user_id, lower(name), location) WHERE disposition IS NULL`. Dedupe existing rows first.
  - Translate `SQLITE_CONSTRAINT_UNIQUE` to `ConflictError` in both repositories.

### 4. Wrong default `DB_PATH` (S) — DONE
- Source: BE 1.
- `config.ts` line 10 resolves to the repo's parent directory, not `./data/myfood.db` as documented. Use `path.resolve(process.cwd(), 'data/myfood.db')` and add a test.

### 5. `LIKE` wildcards not escaped; SQLite and in-memory repositories diverge (S) — DONE
- Sources: HEALTH 2, BE 4.
- Searching `%` or `_` matches everything in SQLite but not in memory. Escape `\`, `%` and `_` and add `ESCAPE '\'`. Test against both repositories (see item 14).

### 6. Dependency vulnerabilities (S) — DONE
- Source: HEALTH 10.
- `npm audit --omit=dev` reports 14 issues, including `body-parser` (DoS) on the public request path.
- Run `npm audit fix` in the root and in `web/`, keep the `eslint@9` and `typescript@5.9` pins, and re-run the tests. Check which findings are dev-only.

### 7. Config numeric env vars are unvalidated (S) — DONE
- Source: HEALTH 8.
- `PORT=abc` or a bad `NOTIFICATION_POLL_INTERVAL_MS` becomes `NaN`. A `NaN` poll interval makes `setInterval` fire every 1 ms.
- Validate with zod or a helper that throws on non-finite values.

### Status: items 1-7 done (tested and reviewed, no high-priority findings)
- Item 6 note: root audit fix applied; remaining prod findings need major bumps (zod 3, zod-to-openapi, uuid; uuid not exploitable, only v4() used). `web/` still has minimatch/undici findings; moving `shadcn` to `devDependencies` is an open decision.
- Deploy notes: all pre-deploy JWTs are invalid (no iss/aud), so users must log in again; default `DB_PATH` is now relative to cwd.

### Follow-ups from review (medium/low, not yet done)
- Migration 006 appends a note to `notes`; check whether the domain schema caps `notes` length and trim or move the audit trail if so.
- Legacy `user_id IS NULL` rows are exempt from the unique index; add a migration test for NULL-owner duplicates and document it.
- In-memory repo lowercases Unicode but SQLite `lower()` is ASCII-only; add a non-ASCII contract test and decide whether to normalise or document.
- Confirm the web client handles 401 cleanly after the token invalidation.
- `isUniqueViolation` should not map PRIMARYKEY violations for food items (misleading message).
- Share the duplicate-message helper in `core/domain/errors.ts`; import `ConflictError`/`NotFoundError` from there and drop the re-export.
- Re-indent the new `try` blocks in the SQLite repositories; run the formatter.
- `web/` `format:check` fails on `web/README.md` and `web/test-results/.last-run.json` (pre-existing).

---

## Tier 2: Reliability before real notifications ship — items 8-12 DONE

### Status: items 8-12 done (planned, implemented, reviewed, fixed, re-tested; no HIGH findings)
- Final state: root typecheck/lint/build and 359 backend tests pass; web typecheck/lint/build, 35 tests and e2e pass; runtime smoke test showed one notification across ~8 ticks, PATCH null clearing, 400 on malformed `bestBefore`, clean SIGINT shutdown. Web `format:check` still only has the 2 pre-existing failures.
- Item 8: chained `setTimeout` poller (no overlap, idempotent `start()`, `stop()` awaits in-flight poll); `NotificationLogPort` + `notifications_sent` (migration 007) dedupes per user/item/status/UTC day; delivery is at-least-once (notify, then mark). Shutdown stops poller and HTTP server concurrently, then closes DBs.
- Item 9: strict ISO `bestBefore` (`YYYY-MM-DD` = UTC midnight, or full datetime with Z/offset). Future-only on create; on PATCH only when the value changes (checked in `FoodItemService.updateItem`). `quantity` stays > 0 (use dispose CONSUMED for "ran out"). OpenAPI uses docs-only `CreateFoodItemDoc`/`UpdateFoodItemDoc` in `registry.ts`.
- Item 10: `notes`/`minimumQuantity` accept `null` on PATCH to clear; SQLite `update` is a single `UPDATE … RETURNING`; in-memory uses `applyUpdate`. Web form sends dirty-only values, `null` when emptied. `schema.d.ts` regenerated from a live backend.
- Item 11: `x-api-key` header, search timeout, bounded `TtlCache`, search-result cache with in-flight coalescing (normalised ingredient key also used upstream), no key in logs/errors, ingredients capped and sorted by soonest expiry. New env vars: `SPOONACULAR_TIMEOUT_MS`, `SPOONACULAR_ENRICHMENT_TIMEOUT_MS`, `RECIPE_CACHE_TTL_MS`, `RECIPE_CACHE_MAX_ENTRIES`, `RECIPE_MAX_INGREDIENTS`.
- Item 12: CLI `npm run assign-orphans -- --email <user> [--dry-run]` (prod: `node dist/cli/assign-orphaned-items.js`). Orphan duplicates are soft-discarded, never deleted. Startup guard stays strict; its message points to the CLI.
- Deploy notes: migration 007 runs automatically; item 11 changes how the key is sent (header, not query); legacy-DB flow requires a registered user first.

### Follow-ups from review (medium/low, not yet done)
- `NotificationPoller`: a manual `poll()` in flight before `start()` means `start()` never schedules; fix by calling `schedule()` in `poll()`'s `finally` (unreachable in production).
- SQLite update-time unique violation gives a generic `ConflictError` message (service pre-check and in-memory use the detailed one).
- `UpdateFoodItemDoc` repeats the create-only "same-day date is not future" note; spec says `date-time` though date-only is accepted. Add a test that the OpenAPI schema keys match the domain schemas.
- Missing tests: service-level `bestBefore` changed-only check, SQLite update-time conflict, SQLite single-statement `update` assertion, date-only unchanged PATCH.
- `NotificationLog` SQLite adapter opens a third connection and `filterUnsent` does one SELECT per alert; consider sharing the connection and batching.
- Search path has no negative caching/circuit breaker; a Spoonacular outage costs 8s per new request; `TtlCache` is FIFO, not LRU.
- `assign-orphans` entry-point detection breaks via symlinks (use `realpathSync`); `tsx` is needed for the npm script, so confirm it is a dependency, and that the Dockerfile ships `dist/cli`.
- Empty PATCH `{}` still bumps `updated_at`.

### 8. Notification poller overlap and repeat sends (S to M) — DONE
- Sources: BE 2, BE 29, HEALTH 7.
- The poller can overlap runs, because `setInterval` has no in-flight guard, and it re-sends the same expiring items every tick.
- Quick fix (S): a `running` guard or chained `setTimeout`, and awaiting the in-flight poll at shutdown.
- Proper fix (M): a `notifications_sent` table behind a `NotificationLogPort`, notifying only on state transitions or once per day per item.
- This must be done before any email or webhook adapter (F6 below).

### 9. Date validation rules: future-only `bestBefore` and `quantity > 0` (S) — DONE
- Sources: BE 3, HEALTH 9.
- Items that are already expired can't be added, and a client that resends a whole object with a past `bestBefore` fails on PATCH. Enforce the future rule only when the value changes, or allow a grace period.
- Decide whether quantity 0 should be allowed. This affects the consume and low-stock flows.
- Use stricter ISO date parsing than `z.coerce.date()`.

### 10. PATCH can't clear `notes` or `minimumQuantity` (S to M) — DONE
- Source: HEALTH 3.
- Allow `.nullable()` on these fields, and run `update` as a single statement (`UPDATE … RETURNING`) to close the lost-update window (BE 17).

### 11. Spoonacular adapter robustness and key leakage (S to M) — DONE
- Sources: BE 12b, BE 28.
- Add a timeout to `findByIngredients`; today only the enrichment call has one.
- Pass the key in the `x-api-key` header, and log only `err.message`.
- Cache results per ingredient set, bound the TTL cache, and cap and prioritise soon-to-expire ingredients.

### 12. Legacy `user_id IS NULL` row blocks startup (S) — DONE
- Source: HEALTH 6.
- Provide an env flag or CLI to assign orphaned rows to a user, rather than requiring manual SQL.

---

## Tier 3: Frontend UX and polish — items 13-26 DONE

Suggested order: quick wins first, then layout, then skeletons, then inventory, then dashboard and recipes, then cleanup.

### Status: items 13-26 done (planned, implemented in 3 groups, reviewed, fixed, re-verified; no HIGH findings)
- Final state: root typecheck/lint and 359 backend tests pass (backend untouched). Web lint, typecheck and build pass, 146 tests pass (3 consecutive runs), e2e 6/6 (desktop-chromium + mobile-chromium with axe). Web `format:check` still only has the 2 pre-existing failures (`web/README.md`, `web/test-results/.last-run.json`). Runtime smoke test at 1280px and 375px passed (register, add with expiry preset + toast, empty state, filters, consume, kebab, dashboard, shopping, recipes error without API key, dark mode persistence, corrupted-token redirect with notice).
- Key decisions:
  - Shell: `AppLayout` stays in `pages/`, with a mobile sheet, account menu (email, theme, logout) and a single `<main id="main-content">`. Pages use `PageHeader` and must not render their own `<main>`.
  - Theme: `useTheme` (light/dark/system) in `shell/`, plus an external `public/theme-init.js` because the nginx CSP forbids inline scripts. Keep it in sync with `shell/theme.ts`. `--warning`/`--success` tokens added; primary is now green.
  - Toasts: `sonner`, with toasts living in the mutation hooks. Undo exists for edit (not when `bestBefore` changed) and remove (re-POST, new id; only when `bestBefore` is in the future). There is NO undo for consumed/discarded (no restore endpoint; recorded in `next-steps.md`).
  - Inventory: always-mounted `ItemFormDialog` + hoisted `ItemList` dialogs, kebab menu, `NativeSelect`. Filters live in URL params with `useInventoryFilters`, chips and numbered `Pagination`. Sort, `lowStock` and `expiringBefore` are DEFERRED until backend item 28.
  - Dashboard uses existing endpoints only: three `limit=1` count queries (`['food-items','count',loc]`) and a low-stock list derived from `/shopping/summary`.
  - Recipes: `useQuery(enabled:false)` with manual refetch, cached across navigation and dropped when inventory mutates; `AuthProvider` clears the query cache on logout/401.
  - Shopping: ticks persisted per user in localStorage (`myfood.shopping.checked.<userId>`, not cleared on logout), pruned after a successful load; identical entries are de-duplicated.
  - Hygiene: lazy routes, per-route error boundaries, 401 handling that ignores stale tokens, load-time `/auth/me` failures (network/5xx) keep the token and show a Retry panel, `lib/date.ts` and `lib/expiry.ts` as single sources.
- Deploy notes: new dependencies `sonner` and `@axe-core/playwright` (dev). Rebuild the `web` Docker image so `theme-init.js` ships; the Docker/nginx CSP path for it was not exercised here (only Vite dev and `vite build` output were checked).

### Follow-ups from review (not yet done)
- MEDIUM: `InventoryPage` out-of-range redirect can loop if the server returns an inconsistent response (`page === totalPages` but empty `data`). Add `&& page !== totalPages` and wrap `setPage` in `useCallback`.
- MEDIUM: `AuthProvider` in-flight `/auth/me` is not cancelled by logout/login. A late 401 after a deliberate logout shows the "session expired" notice, and a late response after re-login can overwrite the new user. Capture the token at effect start and bail unless `session.getToken()` still matches.
- LOW: `useInventoryFilters` `written` state can go stale after `clear()` when `name` is already empty; `useCheckedItems` prune leaves state unpruned (an item that disappears and returns shows as checked again).
- LOW: Undo for edit overwrites concurrent changes made elsewhere; Undo for remove returns the item with a new id and timestamps; a failed undo can't be retried.
- LOW: the sr-only item name in the Consumed button duplicates the name for `getByText` (use `aria-label`); focus drops to `body` after Consumed/Discarded; several `role="status"` regions can coexist; coarse-pointer 44px rule may inflate dense controls (check visually).
- LOW: Shopping share failure reports "Could not copy"; copy/share include checked items when all are checked; shopping load error has no Retry; no `execCommand` clipboard fallback.
- LOW: dashboard makes 5 requests per load (a stats endpoint would cut that); `RouteAnnouncer` title map is static (pages may use `useDocumentTitle`).
- LOW: remaining fixed-delay `delay()`/`setTimeout` in overview/recipes/shopping tests; `npm audit --omit=dev` in `web/` still reports moderate `shadcn`/`ts-morph` findings (moving `shadcn` to devDependencies is still open).
- Housekeeping: a tester left `smoke.db`/`smoke.log` in the approved temp dir (outside the repo); `.opencode/` is untracked and probably should be gitignored.

### 13. Mobile-responsive navigation and app shell (M) — DONE
- Source: FE 1, FE 10.
- `AppLayout.tsx` has one non-wrapping flex row, so it overflows on phones. Add a mobile sheet or menu, a sticky blurred header, an active-link style, a user dropdown (email, theme, logout), a skip-to-content link and a single `<main>` with a shared container.
- Introduce a `PageHeader` component and unify heading sizes.

### 14. Toast feedback and mutation states (S to M) — DONE
- Source: FE 5, FE 2.
- Add `sonner` for toasts on add, edit, consume and delete, with Undo where possible.
- Fix inline errors that are never cleared in `ItemRow`, and add a try/catch to clipboard copy.
- Add pending and disabled states on mutation buttons to stop double-submits.

### 15. Skeleton loading states and `keepPreviousData` (M) — DONE
- Source: FE 2.
- Replace "Loading…" text on the Inventory, Alerts, Shopping, Dashboard and Recipes pages with skeletons.
- Use `placeholderData: keepPreviousData` on the paginated inventory query.

### 16. Empty states with a call to action (S) — DONE
- Source: FE 6.
- Build a reusable `EmptyState` with an icon, an explanation and a CTA: "Add your first item", "Clear filters".
- Distinguish "no items yet" from "no filter matches".

### 17. Inventory row actions and hierarchy (M) — DONE
- Source: FE 4, FE 11.
- Make Consumed the primary action, and move Edit, Discarded and Remove into a kebab `DropdownMenu`. Style Remove and its confirm as destructive.
- Fix label-in-name (visible text versus `aria-label`).
- Add status accents for expired and expiring rows, badges instead of dot-separated text, relative dates with `<time>`, and optionally a table on `md+`.
- Hoist the per-row dialogs to list level.

### 18. Shared select component and consistent form controls (M) — DONE
- Source: FE 3, FE 12.
- Three ad-hoc native `select` class strings, with no focus ring. Create a shared `NativeSelect` (or use shadcn `Select`).
- On the item form: a two-column grid on `sm+`, `type="number"`/`inputMode`, autofocus, a notes counter, `max-h-[90dvh] overflow-y-auto`, expiry presets (+3d, +1w, +1m), and a submit spinner.
- Control the dialog's `open` state so exit animations run.

### 19. Theme and colour fixes (S) — DONE
- Source: FE 9.
- Replace hard-coded `text-red-600` and `bg-yellow-200` with semantic tokens (`text-destructive` and a warning token).
- Make `ThemeToggle` an icon button with a System option, and add an inline script in `index.html` to prevent the dark-mode flash.
- Add `theme-color`, `color-scheme` and a favicon.

### 20. Visual modernisation (M) — DONE
- Source: FE 7.
- Use `Card` consistently with hover and focus states. Add stat-card icons and colour coding, rounded-xl and subtle shadows.
- Check the primary colour in `index.css`; it may still be the default neutral grey.

### 21. Accessibility pass (M) — DONE
- Source: FE 10.
- Per-route `document.title`, focus management on route change, `role="alert"` on form errors with focus on the first invalid field, `aria-live` result counts, pagination labels, `role="status"` on loading messages, 44px tap targets, and `prefers-reduced-motion`.
- Add `@axe-core/playwright` and a mobile viewport project to the e2e suite.

### 22. Dashboard improvements (M) — DONE
- Source: FE 8.
- Handle `isError`. Add a low-stock list, a per-location breakdown, quick actions, and links on the alert items.
- Stop fetching a full inventory page just to read `total`.

### 23. Recipes page (S to M) — DONE
- Source: FE 13.
- It uses `useMutation` for a GET, so results are lost on navigation. Switch to `useQuery` with a manual refetch.
- Responsive card grid, lazy-loaded images, and badges for missing and used ingredients. Remove the `data!` non-null assertion.

### 24. Inventory filters and search (M) — DONE
- Source: FE 11, BE 21.
- Extract `useDebouncedValue` and `useInventoryFilters`, which also removes the exhaustive-deps `eslint-disable`.
- Add Clear filters, active chips, a result count, sort, and numbered pagination.
- The sort, `lowStock` and `expiringBefore` options need backend support (item 28).

### 25. Shopping page (S) — DONE
- Source: FE 14.
- Add checkboxes persisted in localStorage, reason badges, and print/share. Reset the "Copied" status.

### 26. Frontend hygiene (S to M) — DONE
- Source: FE 15 to 18.
- Move `statusText` out of a page file and de-duplicate the expiry logic.
- Add route-level code-splitting and per-route error boundaries.
- Add one `Intl` date helper. Check 401 handling in `api/client.ts` and `AuthProvider.tsx`; neither review read it.
- Auth-page polish: password toggle, `autoComplete`, spinner. Improve the 404 page, the offline banner (add "back online") and the error boundary (add reload).

---

## Tier 4: Backend product features — items 27-32 DONE

### Status: items 27-32 done (planned, implemented in 3 groups, reviewed, fixed, re-reviewed, HIGH fixed; web UI for these is not built)
- Final state: root typecheck/lint/build clean, 584 backend tests pass (581 at the last full tester run; +3 from the final fix, which was re-run by the fix agent only); web typecheck/lint/build and 146 tests pass; e2e 6/6 and web `format:check` (only the 2 known pre-existing failures) were run before the final fix and not re-run after it. Coverage 98.0% statements / 91.9% branches (before the final fix). Runtime smoke test (before the final fix): migrations 12 rows and idempotent on restart, consume rounding, date-only bounds, shopping cap (500 then 422, import at cap creates nothing), webhook retried while failing then delivered once, console notified once, SIGTERM exit 0. `web/src/api/schema.d.ts` regenerated from a built server.
- Not re-run after the final HIGH fix: e2e, runtime smoke, coverage. Not run at all: upgrade from a DB at migration 011 only, real Spoonacular calls, non-Chromium browsers.
- Key decisions:
  - 28: `sort`/`order` (whitelist: bestBefore, name, addedAt, quantity; `id` tiebreak), `lowStock`, `expiringBefore`, `status`, `totalPages` (0 when empty). List `status=expiring` uses the global `EXPIRY_ALERT_DEFAULT_DAYS`, not the user's `alertWithinDays`. Shared `expiryThreshold()` (UTC 24h multiples). Date-only `to`/`expiringBefore` = end of UTC day; datetimes need a timezone, `+` must be encoded as `%2B`.
  - 27: `GET /food-items/history`, `GET /stats/waste` (counts items, UTC byMonth, wasteRate 4 dp, default last 90 days), `POST /food-items/:id/restore` (409 on active duplicate), `DisposedPurgeJob` (`DISPOSED_RETENTION_DAYS` 365, 0 disables; `DISPOSED_PURGE_INTERVAL_MS`), migration 008. Retention bounds how far back stats can look.
  - 29: `POST /food-items/:id/consume {amount}`, atomic single UPDATE; amount >= quantity (or a remainder rounding to 0) disposes CONSUMED; response `{item, disposed, lowStock}`; partial consumes produce no history/stats.
  - 30: webhook (HMAC-SHA256 over `ts.body`) + composite + console, selected by `NOTIFICATION_CHANNELS`; `notify(recipient, alerts)`. Per-channel dedupe via migration 012 so a failing channel doesn't re-notify the others. SMTP email deferred.
  - 31: `GET|PUT /settings` (migration 009), favourites (migration 011), diet/intolerances use Spoonacular `complexSearch` (max 3 most urgent ingredients) with deliberately NO fallback to unfiltered search (allergy safety; empty means nothing matched). Recipes re-ranked by soon-expiring items. `settings.channel` is stored but not honoured yet.
  - 32: shelf-life suggestions (static table, advisory), CSV/JSON export (formula-injection guard, BOM), persisted shopping list (migration 010, cap 500, atomic create/import).
- Deploy notes: migrations 008-012 run automatically (012 recreates `notifications_sent`; `busy_timeout=5000` now set on all SQLite connections). New env vars: `DISPOSED_RETENTION_DAYS`, `DISPOSED_PURGE_INTERVAL_MS`, `NOTIFICATION_CHANNELS`, `NOTIFICATION_WEBHOOK_URL`/`_SECRET`/`_TIMEOUT_MS`. `NOTIFICATION_WITHIN_DAYS` is now only a fallback behind per-user `alertWithinDays`. Purge hard-deletes disposed rows past retention. Stricter date query parsing may reject loose formats that were previously accepted. `NotificationPort.notify` signature changed (custom adapters must update).

### Follow-ups from review (not yet done)
- Web: no UI yet for sort/filters (item 24 deferrals now unblocked), history/waste stats, restore, partial consume, settings, favourites, shopping list, export, shelf-life prefill.
- MEDIUM: `settings.channel` not honoured by the poller; `findByIngredients`-style result quality for complexSearch with few ingredients is unverified against the real API; favourites cap check is not atomic.
- LOW: `expiringSoon` matching is substring-based ("egg" matches "eggplant"); shopping-list update cannot clear `quantity`/`unit`; JSON export includes `userId`; export built fully in memory; shopping import dedupes by name only; name sort differs on non-ASCII names (SQLite NOCASE vs JS lowercase); history rows keep original quantity (consumed amount not recorded); `sort`/`order` defaults may be missing from OpenAPI; missing tests for SQLite restore 409 on a real unique violation and for purge racing `stop()`; a one-off 401 flake in `food-item.controller.test.ts` was seen once and did not reproduce in 3 runs; verify `schema.d.ts` has no diff after regeneration at deploy time.
- Housekeeping: scratch dirs `.../T/opencode/t` and `.../T/opencode/final` could not be deleted by agents (outside the repo; remove manually); `.opencode/` is untracked and probably should be gitignored.

### 27. Disposal history and waste statistics (M, High value) — DONE
- Source: BE F1.
- Disposal data is captured (migration 005) but never readable. Add `GET /food-items/history` and `GET /stats/waste`.
- Include restore of a disposed item (F2, S) and a retention purge job for old disposed rows (F10, S).

### 28. List endpoint filters, sort and pagination metadata (M) — DONE
- Source: BE 21.
- Add `sort`/`order`, `lowStock`, `expiringBefore` and `status` parameters, plus `totalPages`. Confirm that `PaginationSchema` caps `limit`. This unblocks item 24.

### 29. Partial consumption endpoint (S) — DONE
- Source: BE F4.
- `POST /food-items/:id/consume {amount}` decrements quantity and triggers low-stock handling.

### 30. Real notification channels (M) — DONE
- Source: BE F6.
- Email or webhook `NotificationPort` adapters. Depends on item 8's dedupe log.

### 31. Per-user settings and recipe preferences (M) — DONE
- Sources: BE F5, F7.
- A `user_settings` table (alert window, diet and intolerances, channel). Also prioritise expiring items in recipes and add a favourites list.

### 32. Smaller product ideas (S to M each) — DONE
- Source: BE F3, F8, F9.
- A persisted shopping list, CSV/JSON export, and category-based shelf-life suggestions.

---

## Tier 5: Architecture, hardening and test health

### 33. Test gaps and a shared repository contract suite (M)
- Sources: BE 25, 26, 27.
- Add tests for:
  - `config.ts`
  - the auth middleware's header edge cases
  - the shopping-summary and expiry-alert services
  - the user SQLite repository (confirm whether it exists)
- Extract a `runFoodItemRepositoryContract` suite and run it against both repositories. This prevents the divergence in item 5.
- Use fake timers consistently. Consider an OpenAPI snapshot test, since `schema.d.ts` is regenerated manually.
- Confirm coverage with `npm run test:coverage` first.

### 34. Structured error responses (M)
- Source: BE 22.
- Stable `code` fields (for example `DUPLICATE_ITEM`), a request/correlation ID, and no raw Zod `details`. This overlaps with the deferred correlation-ID item.

### 35. Refactors (S each)
- Source: BE 6, 7, 14, 15, 16, 17, 19.
- Move `ConflictError` and `NotFoundError` to `core/domain/errors.ts`.
- Replace `user_id ?? ''` with an explicit invariant.
- Change `createApp` and the router to take a dependency object.
- Add an `asyncHandler` wrapper, or move to Express 5.
- Add a `getUserId(req)` helper instead of `req.userId!`.
- Add `ping()` to the repository instead of exposing `getConnection()`.
- Make the shopping-summary threshold (hard-coded at 3 days) configurable.

### 36. Auth and rate-limit hardening (M)
- Sources: BE 10, 12, 13, HEALTH 5.
- Per-account (IP plus email) login limiting, and a persistent rate-limit store if running multi-instance.
- Password policy: bcrypt truncates at 72 bytes, so `max(200)` is misleading. Make the bcrypt cost configurable.
- Fail startup on `CORS_ORIGIN` unset in production, and optionally gate `/api/docs`.
- Registration email enumeration via 409: document it as an accepted trade-off, or add email verification (M).

### 37. SQLite tuning and indexes (S to M)
- Source: BE 18, 30.
- Add `busy_timeout`, `foreign_keys = ON` and `synchronous = NORMAL`. Consider one shared connection.
- Add a `(user_id, best_before)` index and a `findExpiringBefore` repository method. `food_items.user_id` has no FK.

### 38. Optimistic concurrency and caching headers (M)
- Source: BE 20, 24.
- ETag/`If-Match` for concurrent edits, and `Cache-Control: no-store` on authenticated responses.

---

## Not yet reviewed
- Recipe and shopping-summary controllers, `ttl-cache.ts`, `.github/workflows/ci.yml`.
- Web token storage and 401 handling, web tests and Playwright e2e.
- Later phases of `frontend-implementation.md`. (`web/src/api/schema.d.ts` was diffed against a live backend and regenerated during Tier 2.)
