# MYFood web

React 19 + TypeScript SPA for the MYFood API (Vite, Tailwind 4, shadcn/ui, TanStack Query).

## Commands (run from `web/`)
- `npm run dev` — Vite on :5173, proxies `/api` to `http://localhost:3000` (override with `VITE_API_PROXY_TARGET`)
- `npm run build` / `npm run lint` / `npm run typecheck` / `npm test` / `npm run format:check`
- `npm run openapi:generate` — regenerate `src/api/schema.d.ts` from a running backend; commit the result
- `npm run e2e` — Playwright against a real backend (`DB_PATH=:memory:`, port 3100) and Vite (port 5174), both started automatically. First run: `npx playwright install chromium`

## Deployment
`Dockerfile` builds the SPA and serves it with nginx (`nginx.conf`): SPA fallback, `/api/` proxied to `myfood-service:3000`, CSP with `connect-src 'self'`. Same-origin, so no CORS is needed; the API runs with `TRUST_PROXY=1`. See the root README ("Running with Docker").
