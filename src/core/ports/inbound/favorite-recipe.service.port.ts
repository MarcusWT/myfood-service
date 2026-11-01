import { FavoriteRecipe, FavoriteRecipeInput } from '../../domain/favorite-recipe.js';

export interface FavoriteRecipeServicePort {
  list(userId: string): Promise<FavoriteRecipe[]>;
  add(userId: string, recipeId: number, input: FavoriteRecipeInput): Promise<FavoriteRecipe>;
  remove(userId: string, recipeId: number): Promise<void>;
}
