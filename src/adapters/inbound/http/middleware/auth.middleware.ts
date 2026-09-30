import { Request, Response, NextFunction } from 'express';
import { AuthServicePort } from '../../../../core/ports/inbound/auth.port.js';
import { UnauthorizedError } from '../../../../application/auth.service.js';

/**
 * Express module augmentation attaching the authenticated user id to the
 * request object once a valid Bearer token has been verified.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function createAuthMiddleware(authService: AuthServicePort) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    try {
      const userId = await authService.verifyToken(token);
      req.userId = userId;
      next();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        res.status(401).json({ error: err.message });
        return;
      }
      next(err);
    }
  };
}
