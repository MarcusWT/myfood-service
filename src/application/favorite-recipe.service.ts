import { FavoriteRecipe, FavoriteRecipeInput } from '../core/domain/favorite-recipe.js';
import { LimitExceededError } from '../core/domain/errors.js';
import { FavoriteRecipeServicePort } from '../core/ports/inbound/favorite-recipe.service.port.js';
import { FavoriteRecipeRepositoryPort } from '../core/ports/outbound/favorite-recipe.repository.port.js';

const MAX_FAVORITE_RECIPES = 500;

export class FavoriteRecipeService implements FavoriteRecipeServicePort {
  constructor(private readonly repository: FavoriteRecipeRepositoryPort) {}

  list(userId: string): Promise<FavoriteRecipe[]> {
    return this.repository.list(userId);
  }

  async add(userId: string, recipeId: number, input: FavoriteRecipeInput): Promise<FavoriteRecipe> {
    const ids = await this.repository.ids(userId);
    if (ids.size >= MAX_FAVORITE_RECIPES && !ids.has(recipeId)) {
      throw new LimitExceededError(`Favourites are limited to ${MAX_FAVORITE_RECIPES} recipes`);
    }
    return this.repository.upsert(userId, {
      recipeId,
      title: input.title,
      imageUrl: input.imageUrl,
      sourceUrl: input.sourceUrl,
      createdAt: new Date(),
    });
  }

  async remove(userId: string, recipeId: number): Promise<void> {
    await this.repository.remove(userId, recipeId);
  }
}
