import { FavoriteRecipe } from '../../domain/favorite-recipe.js';

export interface FavoriteRecipeRepositoryPort {
  /** Newest first. */
  list(userId: string): Promise<FavoriteRecipe[]>;
  /** Idempotent; keeps the original createdAt when already present. */
  upsert(userId: string, favorite: FavoriteRecipe): Promise<FavoriteRecipe>;
  remove(userId: string, recipeId: number): Promise<boolean>;
  ids(userId: string): Promise<Set<number>>;
}
