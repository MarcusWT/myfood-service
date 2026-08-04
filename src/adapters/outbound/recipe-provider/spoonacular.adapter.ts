import { Recipe, RecipeIngredient } from '../../../core/domain/recipe.js';
import { RecipeProviderPort } from '../../../core/ports/outbound/recipe-provider.port.js';

interface SpoonacularIngredient {
  name: string;
  amount: number;
  unit: string;
}

interface SpoonacularRecipeResult {
  id: number;
  title: string;
  image: string;
  usedIngredientCount: number;
  missedIngredientCount: number;
  usedIngredients: SpoonacularIngredient[];
  missedIngredients: SpoonacularIngredient[];
}

export class SpoonacularRecipeAdapter implements RecipeProviderPort {
  private readonly baseUrl = 'https://api.spoonacular.com';

  constructor(private readonly apiKey: string) {}

  async findByIngredients(ingredients: string[], limit: number = 5): Promise<Recipe[]> {
    const ingredientList = ingredients.join(',');
    const url = new URL(`${this.baseUrl}/recipes/findByIngredients`);
    url.searchParams.set('apiKey', this.apiKey);
    url.searchParams.set('ingredients', ingredientList);
    url.searchParams.set('number', String(limit));
    url.searchParams.set('ranking', '1'); // maximise used ingredients
    url.searchParams.set('ignorePantry', 'false');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Spoonacular API error: ${response.status} ${response.statusText}`,
      );
    }

    const results = (await response.json()) as SpoonacularRecipeResult[];

    return results.map((r) => {
      const totalIngredients = r.usedIngredientCount + r.missedIngredientCount;
      const matchScore =
        totalIngredients > 0
          ? Math.round((r.usedIngredientCount / totalIngredients) * 100)
          : 0;

      return {
        id: r.id,
        title: r.title,
        imageUrl: r.image,
        sourceUrl: `https://spoonacular.com/recipes/${r.title.toLowerCase().replace(/\s+/g, '-')}-${r.id}`,
        readyInMinutes: 0, // not returned by this endpoint; enrich separately if needed
        servings: 0,
        usedIngredients: r.usedIngredients.map(toRecipeIngredient),
        missedIngredients: r.missedIngredients.map(toRecipeIngredient),
        matchScore,
      };
    });
  }
}

function toRecipeIngredient(i: SpoonacularIngredient): RecipeIngredient {
  return { name: i.name, amount: i.amount, unit: i.unit };
}
