import { Recipe } from '../../domain/recipe.js';

export interface RecipeProviderPort {
  /**
   * Given a list of ingredient names, returns recipe suggestions.
   * @param ingredients - list of ingredient names available
   * @param limit - max number of results (default 5)
   */
  findByIngredients(ingredients: string[], limit?: number): Promise<Recipe[]>;
}
