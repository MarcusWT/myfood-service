import { Recipe } from '../../domain/recipe.js';

export interface RecipeServicePort {
  /**
   * Returns recipe suggestions based on food items currently in stock.
   * @param limit - max number of suggestions to return (default 5)
   */
  getSuggestions(userId: string, limit?: number): Promise<Recipe[]>;
}
