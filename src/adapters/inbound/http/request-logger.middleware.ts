import morgan, { type StreamOptions } from 'morgan';
import type { RequestHandler } from 'express';
import { config } from '../../../config.js';

/**
 * HTTP request logging middleware.
 *
 * Uses morgan's 'dev' format (method, path, status code, response time) in
 * non-test environments. In the 'test' environment it is a no-op so test
 * output (and supertest integration tests) stay clean. Also skips `/health`
 * and `/health/ready`, since these are expected to be polled frequently by
 * orchestrators (Docker/k8s) and would otherwise dominate the access log.
 */
export function createRequestLogger(): RequestHandler {
  if (config.nodeEnv === 'test') {
    return (_req, _res, next) => next();
  }

  const stream: StreamOptions = {
    write: (message: string) => process.stdout.write(message),
  };

  return morgan('dev', {
    stream,
    skip: (req) => req.path === '/health' || req.path === '/health/ready',
  });
}

export const requestLogger = createRequestLogger();
