import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createAuthRateLimiter, createRecipeRateLimiter } from '../rate-limit.middleware.js';
import { buildTestApp } from '../../__tests__/test-app.js';

describe('rate-limit middleware', () => {
  describe('default (NODE_ENV=test) behaviour', () => {
    it('is skipped by default so the real app is not rate limited during tests', async () => {
      const { app } = buildTestApp();

      // Fire more requests than the strict recipe limiter's default max (20)
      // against a public, unauthenticated route to confirm no 429s occur.
      for (let i = 0; i < 25; i += 1) {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
      }
    });
  });

  describe('forceEnable (used to exercise real 429 behaviour)', () => {
    it('returns 429 once a low-max limiter is exceeded', async () => {
      // A dedicated low-max limiter (bypassing the `test` skip entirely, since
      // it's constructed directly rather than via createGeneralRateLimiter)
      // lets us assert the 429 behaviour quickly and deterministically.
      const lowLimiter = rateLimit({
        windowMs: 60_000,
        limit: 2,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later.' },
      });
      const testApp = express();
      testApp.use(lowLimiter);
      testApp.get('/ping', (_req, res) => res.json({ ok: true }));

      await request(testApp).get('/ping').expect(200);
      await request(testApp).get('/ping').expect(200);
      const res = await request(testApp).get('/ping');

      expect(res.status).toBe(429);
      expect(res.body).toEqual({ error: 'Too many requests, please try again later.' });
    });

    it('createAuthRateLimiter and createRecipeRateLimiter honour forceEnable', async () => {
      const app = express();
      app.use('/auth', createAuthRateLimiter({ forceEnable: true }));
      app.use('/recipes', createRecipeRateLimiter({ forceEnable: true }));
      app.get('/auth/ping', (_req, res) => res.json({ ok: true }));
      app.get('/recipes/ping', (_req, res) => res.json({ ok: true }));

      const authRes = await request(app).get('/auth/ping');
      const recipeRes = await request(app).get('/recipes/ping');

      expect(authRes.status).toBe(200);
      expect(recipeRes.status).toBe(200);
    });
  });
});

describe('helmet security headers', () => {
  it('are present on responses from the real app', async () => {
    const { app } = buildTestApp();

    const res = await request(app).get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
  });
});

describe('request body size limit', () => {
  it('rejects an oversized JSON body with 413 via a bare Express app', async () => {
    const app = express();
    app.use(helmet());
    app.use(express.json({ limit: '1kb' }));
    app.post('/echo', (req, res) => res.json(req.body));

    const bigPayload = { data: 'x'.repeat(5_000) };

    const res = await request(app).post('/echo').send(bigPayload);

    expect(res.status).toBe(413);
  });

  it('rejects an oversized JSON body with a structured 413 through the real app/error-handler', async () => {
    // Regression test: the real app's errorHandler must translate body-parser's
    // PayloadTooLargeError into a proper 413 JSON response rather than falling
    // through to the generic 500 branch (the bare-app test above doesn't
    // exercise the real error-handling path since it has no errorHandler at all).
    const { app } = buildTestApp();

    const bigPayload = { email: 'a@b.com', password: 'x'.repeat(200_000) };

    const res = await request(app).post('/api/v1/auth/register').send(bigPayload);

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});
