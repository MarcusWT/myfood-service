import { defineConfig } from '@playwright/test';

const API_PORT = 3100;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'on-first-retry' },
  webServer: [
    {
      // Real backend, in-memory repositories. Spoonacular is never called by these flows.
      command: 'npm run dev',
      cwd: '..',
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: String(API_PORT),
        DB_PATH: ':memory:',
        JWT_SECRET: 'e2e-secret-not-for-production',
        LOG_LEVEL: 'silent',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
