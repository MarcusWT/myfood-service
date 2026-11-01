import { Request, Response, NextFunction } from 'express';
import { DisposalHistoryServicePort } from '../../../core/ports/inbound/disposal-history.service.port.js';
import { HistoryFilterSchema, WasteStatsQuerySchema } from '../../../core/domain/disposal-history.js';
import { PaginationSchema } from '../../../core/domain/pagination.js';

export class DisposalHistoryController {
  constructor(private readonly service: DisposalHistoryServicePort) {}

  listHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = HistoryFilterSchema.parse(req.query);
      const pagination = PaginationSchema.parse(req.query);
      res.json(await this.service.listHistory(req.userId!, filter, pagination));
    } catch (err) {
      next(err);
    }
  };

  getWasteStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const range = WasteStatsQuerySchema.parse(req.query);
      res.json(await this.service.getWasteStats(req.userId!, range));
    } catch (err) {
      next(err);
    }
  };
}
