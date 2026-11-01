import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ExportServicePort } from '../../../core/ports/inbound/export.service.port.js';

export const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('json'),
});

export class ExportController {
  constructor(private readonly service: ExportServicePort) {}

  exportItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { format } = ExportQuerySchema.parse(req.query);
      const result = await this.service.exportFoodItems(req.userId!, format);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.type(result.contentType).send(result.body);
    } catch (err) {
      next(err);
    }
  };
}
