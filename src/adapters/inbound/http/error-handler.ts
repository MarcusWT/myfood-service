import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { NotFoundError, ConflictError } from '../../../application/food-item.service.js';
import { UnauthorizedError } from '../../../application/auth.service.js';

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

  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
}
