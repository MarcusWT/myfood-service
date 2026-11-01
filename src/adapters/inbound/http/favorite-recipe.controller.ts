import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FavoriteRecipeInputSchema } from '../../../core/domain/favorite-recipe.js';
import { FavoriteRecipeServicePort } from '../../../core/ports/inbound/favorite-recipe.service.port.js';

export const FavoriteRecipeParamsSchema = z.object({
  recipeId: z.coerce.number().int().positive(),
});

export class FavoriteRecipeController {
  constructor(private readonly service: FavoriteRecipeServicePort) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.service.list(req.userId!));
    } catch (err) {
      next(err);
    }
  };

  add = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { recipeId } = FavoriteRecipeParamsSchema.parse(req.params);
      const input = FavoriteRecipeInputSchema.parse(req.body);
      res.json(await this.service.add(req.userId!, recipeId, input));
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { recipeId } = FavoriteRecipeParamsSchema.parse(req.params);
      await this.service.remove(req.userId!, recipeId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
