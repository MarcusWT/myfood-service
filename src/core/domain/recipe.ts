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
}
