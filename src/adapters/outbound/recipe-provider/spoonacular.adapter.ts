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

export interface SpoonacularAdapterOptions {
  enrichmentTtlMs?: number;
  enrichmentTimeoutMs?: number;
  searchTimeoutMs?: number;
  searchTtlMs?: number;
  infoCacheMaxEntries?: number;
  searchCacheMaxEntries?: number;
}

const DEFAULT_ENRICHMENT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_ENRICHMENT_TIMEOUT_MS = 5000;
const DEFAULT_SEARCH_TIMEOUT_MS = 8000;
const DEFAULT_SEARCH_TTL_MS = 10 * 60 * 1000;
const DEFAULT_INFO_CACHE_MAX = 1000;
const DEFAULT_SEARCH_CACHE_MAX = 500;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000;

export class SpoonacularRecipeAdapter implements RecipeProviderPort {
  private readonly baseUrl = 'https://api.spoonacular.com';
  private readonly infoCache: TtlCache<EnrichmentInfo>;
  private readonly searchCache: TtlCache<Recipe[]>;
  private readonly inFlight = new Map<string, Promise<Recipe[]>>();
  private readonly enrichmentTtlMs: number;
  private readonly enrichmentTimeoutMs: number;
  private readonly searchTimeoutMs: number;
  private readonly searchTtlMs: number;

  // Lightweight circuit breaker state for the enrichment endpoint only.
  // The primary findByIngredients call is unaffected by this.
  private consecutiveEnrichmentFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    private readonly apiKey: string,
    options: SpoonacularAdapterOptions = {},
  ) {
    this.enrichmentTtlMs = options.enrichmentTtlMs ?? DEFAULT_ENRICHMENT_TTL_MS;
    this.enrichmentTimeoutMs = options.enrichmentTimeoutMs ?? DEFAULT_ENRICHMENT_TIMEOUT_MS;
    this.searchTimeoutMs = options.searchTimeoutMs ?? DEFAULT_SEARCH_TIMEOUT_MS;
    this.searchTtlMs = options.searchTtlMs ?? DEFAULT_SEARCH_TTL_MS;
    this.infoCache = new TtlCache(options.infoCacheMaxEntries ?? DEFAULT_INFO_CACHE_MAX);
    this.searchCache = new TtlCache(options.searchCacheMaxEntries ?? DEFAULT_SEARCH_CACHE_MAX);
  }

  async findByIngredients(ingredients: string[], limit: number = 5): Promise<Recipe[]> {
    const normalized = [
      ...new Set(ingredients.map((i) => i.trim().toLowerCase()).filter(Boolean)),
    ].sort();
    const key = `${normalized.join(',')}|${limit}`;

    const cached = this.searchCache.get(key);
    if (cached) return structuredClone(cached);

    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = this.search(normalized, limit, key).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    return structuredClone(await pending);
  }

  private async search(ingredients: string[], limit: number, key: string): Promise<Recipe[]> {
    const ingredientList = ingredients.join(',');
    const url = new URL(`${this.baseUrl}/recipes/findByIngredients`);
    url.searchParams.set('ingredients', ingredientList);
    url.searchParams.set('number', String(limit));
    url.searchParams.set('ranking', '1'); // maximise used ingredients
    url.searchParams.set('ignorePantry', 'false');

    let results: SpoonacularRecipeResult[];
    try {
      const response = await fetch(url.toString(), {
        headers: { 'x-api-key': this.apiKey },
        signal: AbortSignal.timeout(this.searchTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(
          `Spoonacular API error: ${response.status} ${response.statusText}`,
        );
      }

      results = (await response.json()) as SpoonacularRecipeResult[];
    } catch (error) {
      // Deliberately no `cause`: underlying errors may embed the request URL.
      /* eslint-disable preserve-caught-error */
      if (error instanceof Error && error.message.startsWith('Spoonacular API error')) {
        throw new Error(error.message);
      }
      const timedOut =
        error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new Error(
        timedOut ? 'Spoonacular API request timed out' : 'Spoonacular API request failed',
      );
      /* eslint-enable preserve-caught-error */
    }

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

    const allEnriched = await this.enrichAll(recipes);

    // Don't pin degraded (un-enriched) results in the cache.
    if (allEnriched) this.searchCache.set(key, structuredClone(recipes), this.searchTtlMs);

    return recipes;
  }

  private async enrichAll(recipes: Recipe[]): Promise<boolean> {
    const results = await Promise.all(recipes.map((recipe) => this.enrichOne(recipe)));
    return results.every(Boolean);
  }

  private async enrichOne(recipe: Recipe): Promise<boolean> {
    const cached = this.infoCache.get(String(recipe.id));
    if (cached) {
      recipe.readyInMinutes = cached.readyInMinutes;
      recipe.servings = cached.servings;
      return true;
    }

    if (this.isCircuitOpen()) {
      return false; // leave readyInMinutes/servings at 0 (graceful degradation)
    }

    try {
      const info = await this.fetchRecipeInformation(recipe.id);
      this.infoCache.set(String(recipe.id), info, this.enrichmentTtlMs);
      recipe.readyInMinutes = info.readyInMinutes;
      recipe.servings = info.servings;
      this.consecutiveEnrichmentFailures = 0;
      return true;
    } catch (error) {
      this.recordEnrichmentFailure();
      logger.warn(
        { recipeId: recipe.id, err: safeErrorMessage(error) },
        '[SpoonacularRecipeAdapter] Failed to enrich recipe',
      );
      // Graceful degradation: recipe keeps readyInMinutes: 0, servings: 0
      return false;
    }
  }

  private async fetchRecipeInformation(recipeId: number): Promise<EnrichmentInfo> {
    const url = new URL(`${this.baseUrl}/recipes/${recipeId}/information`);
    url.searchParams.set('includeNutrition', 'false');

    const response = await fetch(url.toString(), {
      headers: { 'x-api-key': this.apiKey },
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

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
