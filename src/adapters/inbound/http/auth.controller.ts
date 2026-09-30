import { Request, Response, NextFunction } from 'express';
import { AuthServicePort } from '../../../core/ports/inbound/auth.port.js';
import { RegisterInputSchema, LoginInputSchema } from '../../../core/domain/user.js';

export class AuthController {
  constructor(private readonly service: AuthServicePort) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = RegisterInputSchema.parse(req.body);
      const result = await this.service.register(input);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = LoginInputSchema.parse(req.body);
      const result = await this.service.login(input);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
