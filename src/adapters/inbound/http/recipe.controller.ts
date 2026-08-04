import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RecipeServicePort } from '../../../core/ports/inbound/recipe.service.port.js';

const RecipeQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).optional(),
});

export class RecipeController {
  constructor(private readonly service: RecipeServicePort) {}

  getSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit } = RecipeQuerySchema.parse(req.query);
      const recipes = await this.service.getSuggestions(limit);
      res.json(recipes);
    } catch (err) {
      next(err);
    }
  };
}
