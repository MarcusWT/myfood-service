import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { NotFoundError } from '../../../application/food-item.service.js';

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

  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
}
