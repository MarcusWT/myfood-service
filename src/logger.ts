import pino from 'pino';
import { config } from './config.js';

/**
 * Shared structured/leveled logger for application-level logs (config
 * warnings, notification poller, Spoonacular circuit breaker events, etc.).
 *
 * This is a cross-cutting concern, kept at the top level alongside
 * config.ts. It must not be imported from `core/domain` or `core/ports`.
 *
 * Silent in the `test` environment so test output (and CI logs) stay
 * clean, mirroring the approach used by `request-logger.middleware.ts` for
 * morgan HTTP access logs.
 */
export const logger = pino({
  level: config.nodeEnv === 'test' ? 'silent' : config.logLevel,
});
