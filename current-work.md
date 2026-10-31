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

## Tier 2: Reliability before real notifications ship

### 8. Notification poller overlap and repeat sends (S to M)
- Sources: BE 2, BE 29, HEALTH 7.
- The poller can overlap runs, because `setInterval` has no in-flight guard, and it re-sends the same expiring items every tick.
- Quick fix (S): a `running` guard or chained `setTimeout`, and awaiting the in-flight poll at shutdown.
- Proper fix (M): a `notifications_sent` table behind a `NotificationLogPort`, notifying only on state transitions or once per day per item.
- This must be done before any email or webhook adapter (F6 below).

### 9. Date validation rules: future-only `bestBefore` and `quantity > 0` (S)
- Sources: BE 3, HEALTH 9.
- Items that are already expired can't be added, and a client that resends a whole object with a past `bestBefore` fails on PATCH. Enforce the future rule only when the value changes, or allow a grace period.
- Decide whether quantity 0 should be allowed. This affects the consume and low-stock flows.
- Use stricter ISO date parsing than `z.coerce.date()`.

### 10. PATCH can't clear `notes` or `minimumQuantity` (S to M)
- Source: HEALTH 3.
- Allow `.nullable()` on these fields, and run `update` as a single statement (`UPDATE … RETURNING`) to close the lost-update window (BE 17).

### 11. Spoonacular adapter robustness and key leakage (S to M)
- Sources: BE 12b, BE 28.
- Add a timeout to `findByIngredients`; today only the enrichment call has one.
- Pass the key in the `x-api-key` header, and log only `err.message`.
- Cache results per ingredient set, bound the TTL cache, and cap and prioritise soon-to-expire ingredients.

### 12. Legacy `user_id IS NULL` row blocks startup (S)
- Source: HEALTH 6.
- Provide an env flag or CLI to assign orphaned rows to a user, rather than requiring manual SQL.

---

## Tier 3: Frontend UX and polish (highest user-visible impact)

Suggested order: quick wins first, then layout, then skeletons, then inventory, then dashboard and recipes, then cleanup.

### 13. Mobile-responsive navigation and app shell (M)
- Source: FE 1, FE 10.
- `AppLayout.tsx` has one non-wrapping flex row, so it overflows on phones. Add a mobile sheet or menu, a sticky blurred header, an active-link style, a user dropdown (email, theme, logout), a skip-to-content link and a single `<main>` with a shared container.
- Introduce a `PageHeader` component and unify heading sizes.

### 14. Toast feedback and mutation states (S to M)
- Source: FE 5, FE 2.
- Add `sonner` for toasts on add, edit, consume and delete, with Undo where possible.
- Fix inline errors that are never cleared in `ItemRow`, and add a try/catch to clipboard copy.
- Add pending and disabled states on mutation buttons to stop double-submits.

### 15. Skeleton loading states and `keepPreviousData` (M)
- Source: FE 2.
- Replace "Loading…" text on the Inventory, Alerts, Shopping, Dashboard and Recipes pages with skeletons.
- Use `placeholderData: keepPreviousData` on the paginated inventory query.

### 16. Empty states with a call to action (S)
- Source: FE 6.
- Build a reusable `EmptyState` with an icon, an explanation and a CTA: "Add your first item", "Clear filters".
- Distinguish "no items yet" from "no filter matches".

### 17. Inventory row actions and hierarchy (M)
- Source: FE 4, FE 11.
- Make Consumed the primary action, and move Edit, Discarded and Remove into a kebab `DropdownMenu`. Style Remove and its confirm as destructive.
- Fix label-in-name (visible text versus `aria-label`).
- Add status accents for expired and expiring rows, badges instead of dot-separated text, relative dates with `<time>`, and optionally a table on `md+`.
- Hoist the per-row dialogs to list level.

### 18. Shared select component and consistent form controls (M)
- Source: FE 3, FE 12.
- Three ad-hoc native `select` class strings, with no focus ring. Create a shared `NativeSelect` (or use shadcn `Select`).
- On the item form: a two-column grid on `sm+`, `type="number"`/`inputMode`, autofocus, a notes counter, `max-h-[90dvh] overflow-y-auto`, expiry presets (+3d, +1w, +1m), and a submit spinner.
- Control the dialog's `open` state so exit animations run.

### 19. Theme and colour fixes (S)
- Source: FE 9.
- Replace hard-coded `text-red-600` and `bg-yellow-200` with semantic tokens (`text-destructive` and a warning token).
- Make `ThemeToggle` an icon button with a System option, and add an inline script in `index.html` to prevent the dark-mode flash.
- Add `theme-color`, `color-scheme` and a favicon.

### 20. Visual modernisation (M)
- Source: FE 7.
- Use `Card` consistently with hover and focus states. Add stat-card icons and colour coding, rounded-xl and subtle shadows.
- Check the primary colour in `index.css`; it may still be the default neutral grey.

### 21. Accessibility pass (M)
- Source: FE 10.
- Per-route `document.title`, focus management on route change, `role="alert"` on form errors with focus on the first invalid field, `aria-live` result counts, pagination labels, `role="status"` on loading messages, 44px tap targets, and `prefers-reduced-motion`.
- Add `@axe-core/playwright` and a mobile viewport project to the e2e suite.

### 22. Dashboard improvements (M)
- Source: FE 8.
- Handle `isError`. Add a low-stock list, a per-location breakdown, quick actions, and links on the alert items.
- Stop fetching a full inventory page just to read `total`.

### 23. Recipes page (S to M)
- Source: FE 13.
- It uses `useMutation` for a GET, so results are lost on navigation. Switch to `useQuery` with a manual refetch.
- Responsive card grid, lazy-loaded images, and badges for missing and used ingredients. Remove the `data!` non-null assertion.

### 24. Inventory filters and search (M)
- Source: FE 11, BE 21.
- Extract `useDebouncedValue` and `useInventoryFilters`, which also removes the exhaustive-deps `eslint-disable`.
- Add Clear filters, active chips, a result count, sort, and numbered pagination.
- The sort, `lowStock` and `expiringBefore` options need backend support (item 28).

### 25. Shopping page (S)
- Source: FE 14.
- Add checkboxes persisted in localStorage, reason badges, and print/share. Reset the "Copied" status.

### 26. Frontend hygiene (S to M)
- Source: FE 15 to 18.
- Move `statusText` out of a page file and de-duplicate the expiry logic.
- Add route-level code-splitting and per-route error boundaries.
- Add one `Intl` date helper. Check 401 handling in `api/client.ts` and `AuthProvider.tsx`; neither review read it.
- Auth-page polish: password toggle, `autoComplete`, spinner. Improve the 404 page, the offline banner (add "back online") and the error boundary (add reload).

---

## Tier 4: Backend product features

### 27. Disposal history and waste statistics (M, High value)
- Source: BE F1.
- Disposal data is captured (migration 005) but never readable. Add `GET /food-items/history` and `GET /stats/waste`.
- Include restore of a disposed item (F2, S) and a retention purge job for old disposed rows (F10, S).

### 28. List endpoint filters, sort and pagination metadata (M)
- Source: BE 21.
- Add `sort`/`order`, `lowStock`, `expiringBefore` and `status` parameters, plus `totalPages`. Confirm that `PaginationSchema` caps `limit`. This unblocks item 24.

### 29. Partial consumption endpoint (S)
- Source: BE F4.
- `POST /food-items/:id/consume {amount}` decrements quantity and triggers low-stock handling.

### 30. Real notification channels (M)
- Source: BE F6.
- Email or webhook `NotificationPort` adapters. Depends on item 8's dedupe log.

### 31. Per-user settings and recipe preferences (M)
- Sources: BE F5, F7.
- A `user_settings` table (alert window, diet and intolerances, channel). Also prioritise expiring items in recipes and add a favourites list.

### 32. Smaller product ideas (S to M each)
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
- Later phases of `frontend-implementation.md`, and a diff of `web/src/api/schema.d.ts` against a live backend.
