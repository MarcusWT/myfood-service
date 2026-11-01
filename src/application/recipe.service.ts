import { expiryThreshold } from '../core/domain/food-item.js';
import { Recipe } from '../core/domain/recipe.js';
import { RecipeServicePort } from '../core/ports/inbound/recipe.service.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';
import { RecipeProviderPort } from '../core/ports/outbound/recipe-provider.port.js';
import { UserSettingsRepositoryPort } from '../core/ports/outbound/user-settings.repository.port.js';
import { FavoriteRecipeRepositoryPort } from '../core/ports/outbound/favorite-recipe.repository.port.js';

const EXPIRING_PRIORITY_COUNT = 3;
const DEFAULT_ALERT_DAYS = 7;

export interface RecipeServiceOptions {
  maxIngredients?: number;
  settings?: UserSettingsRepositoryPort;
  favorites?: FavoriteRecipeRepositoryPort;
  defaultAlertDays?: number;
}

export class RecipeService implements RecipeServicePort {
  private readonly maxIngredients: number;
  private readonly settings?: UserSettingsRepositoryPort;
  private readonly favorites?: FavoriteRecipeRepositoryPort;
  private readonly defaultAlertDays: number;

  constructor(
    private readonly repository: FoodItemRepositoryPort,
    private readonly recipeProvider: RecipeProviderPort,
    options: RecipeServiceOptions = {},
  ) {
    this.maxIngredients = options.maxIngredients ?? 10;
    this.settings = options.settings;
    this.favorites = options.favorites;
    this.defaultAlertDays = options.defaultAlertDays ?? DEFAULT_ALERT_DAYS;
  }

  async getSuggestions(userId: string, limit: number = 5): Promise<Recipe[]> {
    const items = await this.repository.findAll(userId);
    if (items.length === 0) return [];

    // Only use non-expired items for suggestions
    const now = new Date();
    const seen = new Set<string>();
    const sorted = items
      .filter((item) => item.bestBefore >= now)
      .sort(
        (x, y) =>
          x.bestBefore.getTime() - y.bestBefore.getTime() || x.name.localeCompare(y.name),
      );
    const deduped = sorted.filter((item) => {
      const k = item.name.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const picked = deduped.slice(0, this.maxIngredients);
    const availableIngredients = picked.map((item) => item.name);

    if (availableIngredients.length === 0) return [];

    const prefs = (await this.settings?.get(userId)) ?? null;
    const options: { diet?: string; intolerances?: string[] } = {};
    if (prefs?.diet) options.diet = prefs.diet;
    if (prefs && prefs.intolerances.length > 0) options.intolerances = prefs.intolerances;

    const recipes =
      Object.keys(options).length > 0
        ? await this.recipeProvider.findByIngredients(availableIngredients, limit, options)
        : await this.recipeProvider.findByIngredients(availableIngredients, limit);

    const windowEnd = expiryThreshold(now, prefs?.alertWithinDays ?? this.defaultAlertDays);
    const expiring = new Set(
      picked
        .filter((item) => item.bestBefore <= windowEnd)
        .slice(0, EXPIRING_PRIORITY_COUNT)
        .map((item) => item.name.trim().toLowerCase()),
    );
    const favoriteIds = this.favorites ? await this.favorites.ids(userId) : null;

    if (expiring.size === 0 && !favoriteIds) return recipes;

    const annotated = recipes.map((recipe, index) => {
      const expiringSoon = recipe.usedIngredients
        .map((i) => i.name)
        .filter((name) => {
          const n = name.trim().toLowerCase();
          return [...expiring].some((e) => n === e || n.includes(e) || e.includes(n));
        });
      return { recipe, index, expiringSoon };
    });
    if (expiring.size > 0) {
      annotated.sort((a, b) => b.expiringSoon.length - a.expiringSoon.length || a.index - b.index);
    }
    return annotated.map(({ recipe, expiringSoon }) => ({
      ...recipe,
      ...(expiringSoon.length > 0 ? { expiringSoon } : {}),
      ...(favoriteIds?.has(recipe.id) ? { isFavorite: true } : {}),
    }));
  }
}
