import { describe, it, expect, vi, afterEach } from 'vitest';
import { SpoonacularRecipeAdapter } from '../spoonacular.adapter.js';

const json = (body: unknown) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as Response;
const complex = {
  results: [
    {
      id: 9,
      title: 'Vegan Bowl',
      image: 'https://x.test/9.jpg',
      readyInMinutes: 25,
      servings: 3,
      usedIngredientCount: 1,
      missedIngredientCount: 3,
      usedIngredients: [{ name: 'rice', amount: 1, unit: 'cup' }],
      missedIngredients: [],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('SpoonacularRecipeAdapter preferences', () => {
  it('uses findByIngredients without preferences', async () => {
    const f = vi.fn(async (url: string) =>
      json(url.includes('/information') ? { readyInMinutes: 1, servings: 1 } : []),
    );
    vi.stubGlobal('fetch', f);
    await new SpoonacularRecipeAdapter('k').findByIngredients(['rice'], 5, {});
    expect(f.mock.calls[0][0]).toContain('/recipes/findByIngredients');
  });

  it('uses complexSearch with diet/intolerances and maps results without enrichment', async () => {
    const f = vi.fn(async () => json(complex));
    vi.stubGlobal('fetch', f);
    const recipes = await new SpoonacularRecipeAdapter('k').findByIngredients(['rice', 'Egg'], 4, {
      diet: 'vegan',
      intolerances: ['soy', 'egg'],
    });
    expect(f).toHaveBeenCalledTimes(1);
    const url = new URL(f.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/recipes/complexSearch');
    expect(url.searchParams.get('diet')).toBe('vegan');
    expect(url.searchParams.get('intolerances')).toBe('egg,soy');
    expect(url.searchParams.get('includeIngredients')).toBe('rice,egg');
    expect(url.searchParams.get('number')).toBe('4');
    expect(url.search).not.toContain('apiKey');
    expect(recipes[0]).toMatchObject({ id: 9, readyInMinutes: 25, servings: 3, matchScore: 25 });
    expect(recipes[0].usedIngredients).toHaveLength(1);
  });

  it('sends only the 3 most urgent ingredients to complexSearch', async () => {
    const f = vi.fn(async () => json(complex));
    vi.stubGlobal('fetch', f);
    const a = new SpoonacularRecipeAdapter('k');
    await a.findByIngredients(['milk', 'zucchini', 'rice', 'apple', 'bread'], 5, { diet: 'vegan' });
    const url = new URL(f.mock.calls[0][0] as string);
    expect(url.searchParams.get('includeIngredients')).toBe('milk,zucchini,rice');
    await a.findByIngredients(['rice', 'milk', 'zucchini', 'beans'], 5, { diet: 'vegan' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('returns [] (no unfiltered fallback) when complexSearch returns nothing, and caches it', async () => {
    const f = vi.fn(async () => json({ results: [] }));
    vi.stubGlobal('fetch', f);
    const a = new SpoonacularRecipeAdapter('k');
    const opts = { intolerances: ['peanut'] };
    expect(await a.findByIngredients(['a', 'b'], 5, opts)).toEqual([]);
    expect(await a.findByIngredients(['a', 'b'], 5, opts)).toEqual([]);
    const urls = f.mock.calls.map((c) => (c as unknown[])[0] as string);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/complexSearch');
    expect(urls.some((u) => u.includes('/findByIngredients'))).toBe(false);
  });

  it('caches per preference set', async () => {
    const f = vi.fn(async () => json(complex));
    vi.stubGlobal('fetch', f);
    const a = new SpoonacularRecipeAdapter('k');
    await a.findByIngredients(['rice'], 5, { diet: 'vegan', intolerances: ['soy', 'egg'] });
    await a.findByIngredients(['rice'], 5, { diet: 'vegan', intolerances: ['egg', 'soy'] });
    expect(f).toHaveBeenCalledTimes(1);
    await a.findByIngredients(['rice'], 5, { diet: 'paleo' });
    expect(f).toHaveBeenCalledTimes(2);
  });
});
