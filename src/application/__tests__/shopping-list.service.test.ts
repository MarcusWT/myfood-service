import { describe, it, expect, beforeEach } from 'vitest';
import { ShoppingListService } from '../shopping-list.service.js';
import { InMemoryShoppingListRepository } from '../../adapters/outbound/persistence/shopping-list.in-memory.repository.js';
import { InMemoryFoodItemRepository } from '../../adapters/outbound/persistence/food-item.in-memory.repository.js';
import { LimitExceededError, NotFoundError } from '../../core/domain/errors.js';
import { MAX_SHOPPING_LIST_ITEMS } from '../../core/domain/shopping-list.js';

const U = '22222222-2222-2222-2222-222222222222';

describe('ShoppingListService', () => {
  let svc: ShoppingListService;
  let food: InMemoryFoodItemRepository;
  beforeEach(() => {
    food = new InMemoryFoodItemRepository();
    svc = new ShoppingListService(new InMemoryShoppingListRepository(), food);
  });

  it('enforces the per-user cap on add', async () => {
    for (let i = 0; i < MAX_SHOPPING_LIST_ITEMS; i++) await svc.add(U, { name: `i${i}`, category: 'OTHER' });
    await expect(svc.add(U, { name: 'over', category: 'OTHER' })).rejects.toBeInstanceOf(LimitExceededError);
    await expect(svc.add('other-user', { name: 'ok', category: 'OTHER' })).resolves.toBeDefined();
  });

  it('concurrent adds near the cap never exceed it', async () => {
    for (let i = 0; i < MAX_SHOPPING_LIST_ITEMS - 3; i++) await svc.add(U, { name: `i${i}`, category: 'OTHER' });
    const res = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => svc.add(U, { name: `c${i}`, category: 'OTHER' })));
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(await svc.list(U)).toHaveLength(MAX_SHOPPING_LIST_ITEMS);
  });

  it('import is all-or-nothing at the cap', async () => {
    for (let i = 0; i < MAX_SHOPPING_LIST_ITEMS - 1; i++) await svc.add(U, { name: `i${i}`, category: 'OTHER' });
    for (const name of ['Old1', 'Old2']) {
      await food.save({
        id: crypto.randomUUID(), userId: U, name, quantity: 1, unit: 'UNITS',
        location: 'FRIDGE', category: 'DAIRY', bestBefore: new Date('2020-01-01'),
        addedAt: new Date(), updatedAt: new Date(),
      });
    }
    await expect(svc.importFromSummary(U)).rejects.toBeInstanceOf(LimitExceededError);
    expect(await svc.list(U)).toHaveLength(MAX_SHOPPING_LIST_ITEMS - 1);
  });

  it('enforces the cap on import', async () => {
    for (let i = 0; i < MAX_SHOPPING_LIST_ITEMS; i++) await svc.add(U, { name: `i${i}`, category: 'OTHER' });
    await food.save({
      id: '11111111-1111-1111-1111-111111111111', userId: U, name: 'Old', quantity: 1, unit: 'UNITS',
      location: 'FRIDGE', category: 'DAIRY', bestBefore: new Date('2020-01-01'),
      addedAt: new Date(), updatedAt: new Date(),
    });
    await expect(svc.importFromSummary(U)).rejects.toBeInstanceOf(LimitExceededError);
  });

  it('import dedupes case-insensitively', async () => {
    await food.save({
      id: '11111111-1111-1111-1111-111111111111', userId: U, name: 'Old', quantity: 1, unit: 'UNITS',
      location: 'FRIDGE', category: 'DAIRY', bestBefore: new Date('2020-01-01'),
      addedAt: new Date(), updatedAt: new Date(),
    });
    await svc.add(U, { name: 'OLD', category: 'OTHER' });
    expect(await svc.importFromSummary(U)).toEqual([]);
    expect(await svc.list(U)).toHaveLength(1);
  });

  it('throws NotFoundError for missing ids', async () => {
    const id = '33333333-3333-3333-3333-333333333333';
    await expect(svc.update(U, id, { checked: true })).rejects.toBeInstanceOf(NotFoundError);
    await expect(svc.remove(U, id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
