import { Recipe } from '../core/domain/recipe.js';
import { RecipeServicePort } from '../core/ports/inbound/recipe.service.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';
import { RecipeProviderPort } from '../core/ports/outbound/recipe-provider.port.js';

export class RecipeService implements RecipeServicePort {
  constructor(
    private readonly repository: FoodItemRepositoryPort,
    private readonly recipeProvider: RecipeProviderPort,
    options: { maxIngredients?: number } = {},
  ) {
    this.maxIngredients = options.maxIngredients ?? 10;
  }

  private readonly maxIngredients: number;

  async getSuggestions(userId: string, limit: number = 5): Promise<Recipe[]> {
    const items = await this.repository.findAll(userId);
    if (items.length === 0) return [];

    // Only use non-expired items for suggestions
    const now = new Date();
    const seen = new Set<string>();
    const availableIngredients = items
      .filter((item) => item.bestBefore >= now)
      .sort(
        (x, y) =>
          x.bestBefore.getTime() - y.bestBefore.getTime() || x.name.localeCompare(y.name),
      )
      .map((item) => item.name)
      .filter((name) => {
        const k = name.trim().toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, this.maxIngredients);

    if (availableIngredients.length === 0) return [];

    return this.recipeProvider.findByIngredients(availableIngredients, limit);
  }
}
