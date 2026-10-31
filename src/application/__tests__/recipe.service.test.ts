import { describe, it, expect, vi } from 'vitest';
import { RecipeService } from '../recipe.service.js';
import { FoodItemRepositoryPort } from '../../core/ports/outbound/food-item.repository.port.js';
import { RecipeProviderPort } from '../../core/ports/outbound/recipe-provider.port.js';

const day = 86_400_000;
const item = (name: string, days: number) => ({ name, bestBefore: new Date(Date.now() + days * day) });

function setup(items: ReturnType<typeof item>[], max?: number) {
  const repo = { findAll: vi.fn(async () => items) } as unknown as FoodItemRepositoryPort;
  const findByIngredients = vi.fn(async () => []);
  const provider = { findByIngredients } as unknown as RecipeProviderPort;
  const service = new RecipeService(repo, provider, max ? { maxIngredients: max } : undefined);
  return { service, findByIngredients };
}

describe('RecipeService', () => {
  it('sorts by soonest expiry, excludes expired, dedupes case-insensitively', async () => {
    const { service, findByIngredients } = setup([
      item('Milk', 5),
      item('egg', 1),
      item('old', -2),
      item('MILK', 2),
      item('apple', 1),
    ]);
    await service.getSuggestions('u', 3);
    expect(findByIngredients).toHaveBeenCalledWith(['apple', 'egg', 'MILK'], 3);
  });

  it('caps ingredients at maxIngredients (default 10)', async () => {
    const items = Array.from({ length: 15 }, (_, i) => item(`i${String(i).padStart(2, '0')}`, i + 1));
    const a = setup(items);
    await a.service.getSuggestions('u');
    expect((a.findByIngredients.mock.calls[0] as unknown[])[0]).toHaveLength(10);
    const b = setup(items, 3);
    await b.service.getSuggestions('u');
    expect((b.findByIngredients.mock.calls[0] as unknown[])[0]).toEqual(['i00', 'i01', 'i02']);
  });

  it('returns [] without calling the provider when nothing is usable', async () => {
    const { service, findByIngredients } = setup([item('old', -1)]);
    expect(await service.getSuggestions('u')).toEqual([]);
    expect(findByIngredients).not.toHaveBeenCalled();
  });
});
