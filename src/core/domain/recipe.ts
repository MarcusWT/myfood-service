export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
}

export interface Recipe {
  id: number;
  title: string;
  imageUrl?: string;
  sourceUrl?: string;
  readyInMinutes: number;
  servings: number;
  usedIngredients: RecipeIngredient[];
  missedIngredients: RecipeIngredient[];
  matchScore: number; // percentage of available ingredients used
  isFavorite?: boolean;
  /** Used ingredients that are among the user's soonest-expiring items. */
  expiringSoon?: string[];
}

export interface RecipeSearchOptions {
  diet?: string;
  intolerances?: string[];
}
