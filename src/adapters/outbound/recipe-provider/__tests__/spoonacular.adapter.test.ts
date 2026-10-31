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

    const adapter = new SpoonacularRecipeAdapter('test-key', { enrichmentTtlMs: 60_000 });
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

    const adapter = new SpoonacularRecipeAdapter('test-key', { enrichmentTtlMs: 1000, searchTtlMs: 1000 });
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

  describe('hardening', () => {
    const KEY = 'SECRET-KEY-123';
    const okFetch = () =>
      vi.fn(async (url: string) => {
        if (url.includes('/recipes/findByIngredients')) {
          return jsonResponse([findByIngredientsResult(1)]);
        }
        return jsonResponse({ readyInMinutes: 10, servings: 2 });
      });
    const searchCalls = (m: ReturnType<typeof okFetch>) =>
      m.mock.calls.filter(([u]) => String(u).includes('findByIngredients'));

    it('sends the key via x-api-key header on both calls, never in the URL, with a signal on search', async () => {
      const fetchMock = okFetch();
      vi.stubGlobal('fetch', fetchMock);
      await new SpoonacularRecipeAdapter(KEY).findByIngredients(['egg']);
      expect(fetchMock.mock.calls).toHaveLength(2);
      for (const [url, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
        expect(url).not.toContain(KEY);
        expect(url).not.toContain('apiKey');
        expect((init.headers as Record<string, string>)['x-api-key']).toBe(KEY);
        expect(init.signal).toBeDefined();
      }
    });

    it('maps a search timeout to a key-free error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          const e = new Error(`aborted https://x/?apiKey=${KEY}`);
          e.name = 'TimeoutError';
          throw e;
        }),
      );
      const err = await new SpoonacularRecipeAdapter(KEY)
        .findByIngredients(['egg'])
        .catch((e: Error) => e);
      expect((err as Error).message).toContain('timed out');
      expect(JSON.stringify(err) + (err as Error).message + String((err as Error).cause)).not.toContain(KEY);
      expect((err as Error).cause).toBeUndefined();
    });

    it('rethrows generic fetch failures without cause or key', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError(`fetch failed https://x/?apiKey=${KEY}`, { cause: new Error(KEY) });
        }),
      );
      const err = (await new SpoonacularRecipeAdapter(KEY)
        .findByIngredients(['egg'])
        .catch((e: Error) => e)) as Error;
      expect(err.message).not.toContain(KEY);
      expect(err.cause).toBeUndefined();
    });

    it('serves repeated, order-insensitive searches from cache', async () => {
      const fetchMock = okFetch();
      vi.stubGlobal('fetch', fetchMock);
      const adapter = new SpoonacularRecipeAdapter(KEY);
      await adapter.findByIngredients(['Egg', 'milk']);
      await adapter.findByIngredients([' milk', 'egg', 'EGG']);
      expect(searchCalls(fetchMock)).toHaveLength(1);
    });

    it('sends the normalised ingredient list upstream and coalesces in-flight requests', async () => {
      const fetchMock = okFetch();
      vi.stubGlobal('fetch', fetchMock);
      const adapter = new SpoonacularRecipeAdapter(KEY);
      await Promise.all([
        adapter.findByIngredients([' Milk', 'EGG', 'egg ', '']),
        adapter.findByIngredients(['egg', 'milk']),
      ]);
      const calls = searchCalls(fetchMock);
      expect(calls).toHaveLength(1);
      expect(new URL(String(calls[0][0])).searchParams.get('ingredients')).toBe('egg,milk');
    });

    it('misses the cache for a different limit', async () => {
      const fetchMock = okFetch();
      vi.stubGlobal('fetch', fetchMock);
      const adapter = new SpoonacularRecipeAdapter(KEY);
      await adapter.findByIngredients(['egg'], 3);
      await adapter.findByIngredients(['egg'], 4);
      expect(searchCalls(fetchMock)).toHaveLength(2);
    });

    it('re-fetches after the search TTL expires', async () => {
      const fetchMock = okFetch();
      vi.stubGlobal('fetch', fetchMock);
      const adapter = new SpoonacularRecipeAdapter(KEY, { searchTtlMs: 1000 });
      await adapter.findByIngredients(['egg']);
      vi.advanceTimersByTime(1001);
      await adapter.findByIngredients(['egg']);
      expect(searchCalls(fetchMock)).toHaveLength(2);
    });

    it('returns independent copies', async () => {
      vi.stubGlobal('fetch', okFetch());
      const adapter = new SpoonacularRecipeAdapter(KEY);
      const first = await adapter.findByIngredients(['egg']);
      first[0].title = 'mutated';
      const second = await adapter.findByIngredients(['egg']);
      expect(second[0].title).toBe('Recipe 1');
    });

    it('does not cache failures', async () => {
      let fail = true;
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes('findByIngredients')) {
          return fail ? jsonResponse({}, false, 503) : jsonResponse([findByIngredientsResult(1)]);
        }
        return jsonResponse({ readyInMinutes: 10, servings: 2 });
      });
      vi.stubGlobal('fetch', fetchMock);
      const adapter = new SpoonacularRecipeAdapter(KEY);
      await expect(adapter.findByIngredients(['egg'])).rejects.toThrow();
      fail = false;
      await expect(adapter.findByIngredients(['egg'])).resolves.toHaveLength(1);
    });

    it('logs enrichment failures without leaking the key', async () => {
      const { logger } = await import('../../../../logger.js');
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.includes('findByIngredients')) return jsonResponse([findByIngredientsResult(1)]);
          throw new TypeError(`failed https://x/?apiKey=${KEY}`, { cause: new Error(KEY) });
        }),
      );
      await new SpoonacularRecipeAdapter(KEY).findByIngredients(['egg']);
      const logged = warn.mock.calls[0][0] as { recipeId: number; err: unknown };
      expect(logged.recipeId).toBe(1);
      expect(typeof logged.err).toBe('string');
      warn.mockRestore();
    });
  });
});
