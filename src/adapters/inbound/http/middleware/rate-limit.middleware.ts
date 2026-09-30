import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { config } from '../../../../config.js';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * Builds an express-rate-limit middleware.
 *
 * In the `test` environment the limiter is skipped by default (returns
 * `true` from `skip`), mirroring the pattern used for morgan request
 * logging (`request-logger.middleware.ts`) and pino (`logger.ts`) — the
 * existing HTTP integration test suite fires many rapid sequential requests
 * against the same app instance and would otherwise trip these limits.
 *
 * Pass `forceEnable: true` (used only by rate-limit-specific tests) to
 * exercise the real 429 behaviour even under `NODE_ENV=test`.
 */
export function createRateLimiter(
  options: RateLimiterOptions,
  { forceEnable = false }: { forceEnable?: boolean } = {},
): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test' && !forceEnable,
    message: { error: options.message ?? 'Too many requests, please try again later.' },
  });
}

/** General limiter applied to all `/api/v1` routes. */
export function createGeneralRateLimiter(
  overrides: { forceEnable?: boolean } = {},
): RequestHandler {
  return createRateLimiter(
    {
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
      message: 'Too many requests, please try again later.',
    },
    overrides,
  );
}

/** Stricter limiter for `/auth/register` and `/auth/login` (brute-force / enumeration mitigation). */
export function createAuthRateLimiter(
  overrides: { forceEnable?: boolean } = {},
): RequestHandler {
  return createRateLimiter(
    {
      windowMs: config.rateLimitWindowMs,
      max: config.authRateLimitMax,
      message: 'Too many authentication attempts, please try again later.',
    },
    overrides,
  );
}

/** Stricter limiter for `/recipes/suggestions`, which proxies the metered Spoonacular API. */
export function createRecipeRateLimiter(
  overrides: { forceEnable?: boolean } = {},
): RequestHandler {
  return createRateLimiter(
    {
      windowMs: config.rateLimitWindowMs,
      max: config.recipeRateLimitMax,
      message: 'Too many recipe suggestion requests, please try again later.',
    },
    overrides,
  );
}
