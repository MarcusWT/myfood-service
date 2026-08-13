import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpoonacularRecipeAdapter } from '../spoonacular.adapter.js';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  } as Response;
}

function findByIngredientsResult(id: number) {
  return {
    id,
    title: `Recipe ${id}`,
    image: `https://example.com/${id}.jpg`,
    usedIngredientCount: 2,
    missedIngredientCount: 1,
    usedIngredients: [{ name: 'egg', amount: 2, unit: 'pcs' }],
    missedIngredients: [{ name: 'flour', amount: 1, unit: 'cup' }],
  };
}

describe('SpoonacularRecipeAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('enriches recipes with readyInMinutes and servings from the information endpoint', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/recipes/findByIngredients')) {
        return jsonResponse([findByIngredientsResult(1)]);
      }
      if (url.includes('/recipes/1/information')) {
        return jsonResponse({ readyInMinutes: 30, servings: 4 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new SpoonacularRecipeAdapter('test-key');
    const recipes = await adapter.findByIngredients(['egg']);

    expect(recipes).toHaveLength(1);
    expect(recipes[0].readyInMinutes).toBe(30);
    expect(recipes[0].servings).toBe(4);
  });

  it('caches enrichment info and does not re-fetch within the TTL', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/recipes/findByIngredients')) {
        return jsonResponse([findByIngredientsResult(1)]);
      }
      if (url.includes('/recipes/1/information')) {
        return jsonResponse({ readyInMinutes: 20, servings: 2 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new SpoonacularRecipeAdapter('test-key', 60_000);
    await adapter.findByIngredients(['egg']);
    await adapter.findByIngredients(['egg']);

    const infoCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/information'),
    );
    expect(infoCalls).toHaveLength(1);
  });

  it('re-fetches enrichment info after the TTL expires', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/recipes/findByIngredients')) {
        return jsonResponse([findByIngredientsResult(1)]);
      }
      if (url.includes('/recipes/1/information')) {
        return jsonResponse({ readyInMinutes: 20, servings: 2 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new SpoonacularRecipeAdapter('test-key', 1000);
    await adapter.findByIngredients(['egg']);

    vi.advanceTimersByTime(1001);

    await adapter.findByIngredients(['egg']);

    const infoCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/information'),
    );
    expect(infoCalls).toHaveLength(2);
  });

  it('leaves readyInMinutes/servings at 0 when enrichment fails, without throwing', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/recipes/findByIngredients')) {
        return jsonResponse([findByIngredientsResult(1)]);
      }
      if (url.includes('/recipes/1/information')) {
        return jsonResponse({}, false, 500);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = new SpoonacularRecipeAdapter('test-key');
    const recipes = await adapter.findByIngredients(['egg']);

    expect(recipes[0].readyInMinutes).toBe(0);
    expect(recipes[0].servings).toBe(0);
  });

  it('does not let one failed enrichment affect other recipes', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/recipes/findByIngredients')) {
        return jsonResponse([findByIngredientsResult(1), findByIngredientsResult(2)]);
      }
      if (url.includes('/recipes/1/information')) {
        return jsonResponse({}, false, 500);
      }
      if (url.includes('/recipes/2/information')) {
        return jsonResponse({ readyInMinutes: 15, servings: 3 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = new SpoonacularRecipeAdapter('test-key');
    const recipes = await adapter.findByIngredients(['egg']);

    const failed = recipes.find((r) => r.id === 1);
    const succeeded = recipes.find((r) => r.id === 2);

    expect(failed?.readyInMinutes).toBe(0);
    expect(succeeded?.readyInMinutes).toBe(15);
    expect(succeeded?.servings).toBe(3);
  });

  it('opens the circuit breaker after repeated enrichment failures and skips further info calls', async () => {
    let infoCallCount = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/recipes/findByIngredients')) {
        return jsonResponse([findByIngredientsResult(1)]);
      }
      if (url.includes('/information')) {
        infoCallCount += 1;
        return jsonResponse({}, false, 500);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = new SpoonacularRecipeAdapter('test-key');

    // Trigger 3 consecutive failures to open the breaker (each search uses a
    // different ingredient list so recipe id 1 is never cached-good).
    await adapter.findByIngredients(['a']);
    await adapter.findByIngredients(['b']);
    await adapter.findByIngredients(['c']);
    expect(infoCallCount).toBe(3);

    // Breaker should now be open; this call should not hit the info endpoint.
    const recipes = await adapter.findByIngredients(['d']);
    expect(infoCallCount).toBe(3);
    expect(recipes[0].readyInMinutes).toBe(0);
  });

  it('propagates an error when the findByIngredients call itself fails', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, false, 503));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new SpoonacularRecipeAdapter('test-key');

    await expect(adapter.findByIngredients(['egg'])).rejects.toThrow(
      'Spoonacular API error',
    );
  });
});
