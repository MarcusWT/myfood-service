import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { CategorySchema, LocationSchema } from '../../../core/domain/value-objects.js';
import { SHELF_LIFE_DAYS, suggestShelfLife } from '../../../core/domain/shelf-life.js';

export const ShelfLifeQuerySchema = z.object({
  category: CategorySchema,
  location: LocationSchema,
});

export class ShelfLifeController {
  getSuggestion = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { category, location } = ShelfLifeQuerySchema.parse(req.query);
      const s = suggestShelfLife(category, location);
      res.json({
        category,
        location,
        days: s ? s.days : null,
        suggestedBestBefore: s ? s.suggestedBestBefore.toISOString() : null,
        source: 'default-table',
      });
    } catch (err) {
      next(err);
    }
  };

  getTable = (_req: Request, res: Response): void => {
    res.json({ source: 'default-table', table: SHELF_LIFE_DAYS });
  };
}
