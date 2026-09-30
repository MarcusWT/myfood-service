import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExpiryAlertServicePort } from '../../../core/ports/inbound/expiry-alert.service.port.js';

export const AlertQuerySchema = z.object({
  withinDays: z.coerce.number().int().positive().optional(),
});

export class ExpiryAlertController {
  constructor(private readonly service: ExpiryAlertServicePort) {}

  getAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { withinDays } = AlertQuerySchema.parse(req.query);
      const alerts = await this.service.getAlerts(req.userId!, withinDays);
      res.json(alerts);
    } catch (err) {
      next(err);
    }
  };
}
