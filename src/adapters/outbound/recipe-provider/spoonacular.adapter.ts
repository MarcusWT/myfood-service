import { Recipe, RecipeIngredient } from '../../../core/domain/recipe.js';
import { RecipeProviderPort } from '../../../core/ports/outbound/recipe-provider.port.js';
import { TtlCache } from './ttl-cache.js';
import { logger } from '../../../logger.js';

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

interface SpoonacularRecipeInformation {
  readyInMinutes: number;
  servings: number;
}

interface EnrichmentInfo {
  readyInMinutes: number;
  servings: number;
}

const DEFAULT_ENRICHMENT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_ENRICHMENT_TIMEOUT_MS = 5000;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000;

export class SpoonacularRecipeAdapter implements RecipeProviderPort {
  private readonly baseUrl = 'https://api.spoonacular.com';
  private readonly infoCache = new TtlCache<EnrichmentInfo>();

  // Lightweight circuit breaker state for the enrichment endpoint only.
  // The primary findByIngredients call is unaffected by this.
  private consecutiveEnrichmentFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    private readonly apiKey: string,
    private readonly enrichmentTtlMs: number = DEFAULT_ENRICHMENT_TTL_MS,
    private readonly enrichmentTimeoutMs: number = DEFAULT_ENRICHMENT_TIMEOUT_MS,
  ) {}

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

    const recipes = results.map((r) => {
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
        readyInMinutes: 0, // enriched below when possible
        servings: 0,
        usedIngredients: r.usedIngredients.map(toRecipeIngredient),
        missedIngredients: r.missedIngredients.map(toRecipeIngredient),
        matchScore,
      };
    });

    await this.enrichAll(recipes);

    return recipes;
  }

  private async enrichAll(recipes: Recipe[]): Promise<void> {
    await Promise.allSettled(recipes.map((recipe) => this.enrichOne(recipe)));
  }

  private async enrichOne(recipe: Recipe): Promise<void> {
    const cached = this.infoCache.get(String(recipe.id));
    if (cached) {
      recipe.readyInMinutes = cached.readyInMinutes;
      recipe.servings = cached.servings;
      return;
    }

    if (this.isCircuitOpen()) {
      return; // leave readyInMinutes/servings at 0 (graceful degradation)
    }

    try {
      const info = await this.fetchRecipeInformation(recipe.id);
      this.infoCache.set(String(recipe.id), info, this.enrichmentTtlMs);
      recipe.readyInMinutes = info.readyInMinutes;
      recipe.servings = info.servings;
      this.consecutiveEnrichmentFailures = 0;
    } catch (error) {
      this.recordEnrichmentFailure();
      logger.warn(
        { recipeId: recipe.id, err: error },
        '[SpoonacularRecipeAdapter] Failed to enrich recipe',
      );
      // Graceful degradation: recipe keeps readyInMinutes: 0, servings: 0
    }
  }

  private async fetchRecipeInformation(recipeId: number): Promise<EnrichmentInfo> {
    const url = new URL(`${this.baseUrl}/recipes/${recipeId}/information`);
    url.searchParams.set('apiKey', this.apiKey);
    url.searchParams.set('includeNutrition', 'false');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(this.enrichmentTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `Spoonacular information API error: ${response.status} ${response.statusText}`,
      );
    }

    const info = (await response.json()) as SpoonacularRecipeInformation;
    return { readyInMinutes: info.readyInMinutes ?? 0, servings: info.servings ?? 0 };
  }

  private isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  private recordEnrichmentFailure(): void {
    this.consecutiveEnrichmentFailures += 1;
    if (this.consecutiveEnrichmentFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      this.consecutiveEnrichmentFailures = 0;
      logger.warn(
        { cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS },
        '[SpoonacularRecipeAdapter] Enrichment circuit breaker opened after repeated failures',
      );
    }
  }
}

function toRecipeIngredient(i: SpoonacularIngredient): RecipeIngredient {
  return { name: i.name, amount: i.amount, unit: i.unit };
}
