import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { NotFoundError, ConflictError } from '../../../application/food-item.service.js';
import { UnauthorizedError } from '../../../application/auth.service.js';
import { logger } from '../../../logger.js';

function isPayloadTooLargeError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    ('type' in err && (err as { type?: unknown }).type === 'entity.too.large')
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      details: err.errors,
    });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
    return;
  }

  if (err instanceof UnauthorizedError) {
    res.status(401).json({ error: err.message });
    return;
  }

  // body-parser throws a PayloadTooLargeError (type 'entity.too.large') when
  // a request body exceeds express.json({ limit }) — surface it as a proper
  // 413 rather than falling through to the generic 500 branch below.
  if (isPayloadTooLargeError(err)) {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }

  // Log only a minimal, known-safe subset of the error rather than the raw
  // caught object: body-parser attaches the raw unparsed request body (which
  // may contain plaintext passwords or other sensitive fields) as `.body` on
  // the SyntaxError it throws for malformed JSON, and logging `{ err }`
  // directly would serialize that straight into log output.
  const safeError =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { message: String(err) };
  logger.error({ err: safeError }, '[Unhandled Error]');
  res.status(500).json({ error: 'Internal Server Error' });
}
