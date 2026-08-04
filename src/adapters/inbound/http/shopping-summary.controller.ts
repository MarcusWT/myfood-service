import { Request, Response, NextFunction } from 'express';
import { ShoppingSummaryServicePort } from '../../../core/ports/inbound/shopping-summary.service.port.js';

export class ShoppingSummaryController {
  constructor(private readonly service: ShoppingSummaryServicePort) {}

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.service.getSummary();
      res.json(summary);
    } catch (err) {
      next(err);
    }
  };
}
