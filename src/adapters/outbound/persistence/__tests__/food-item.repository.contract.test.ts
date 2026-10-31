import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryFoodItemRepository } from '../food-item.in-memory.repository.js';
import { SqliteFoodItemRepository } from '../food-item.sqlite.repository.js';
import type { FoodItemRepositoryPort } from '../../../../core/ports/outbound/food-item.repository.port.js';
import type { FoodItem } from '../../../../core/domain/food-item.js';

const USER = 'user-1';
const names = ['100% Juice', 'snake_case', 'Apple', 'back\\slash', 'Banana'];

const make = (name: string, i: number): FoodItem => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  userId: USER,
  name,
  quantity: 1,
  unit: 'UNITS',
  location: 'FRIDGE',
  category: 'OTHER',
  bestBefore: new Date('2026-09-01'),
  addedAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
});

describe.each([
  ['in-memory', () => new InMemoryFoodItemRepository() as FoodItemRepositoryPort & { close?: () => void }],
  ['sqlite', () => new SqliteFoodItemRepository(':memory:')],
])('FoodItemRepository contract (%s)', (_label, factory) => {
  let repo: FoodItemRepositoryPort & { close?: () => void };

  beforeEach(async () => {
    repo = factory();
    for (const [i, n] of names.entries()) await repo.save(make(n, i + 1));
  });
  afterEach(() => repo.close?.());

  it.each([
    ['%', ['100% Juice']],
    ['_', ['snake_case']],
    ['\\', ['back\\slash']],
    ['a_e', []],
    ['APPLE', ['Apple']],
    ['apple', ['Apple']],
    ['pp', ['Apple']],
  ])('name filter %j', async (needle, expected) => {
    const res = await repo.findAllPaginated(USER, { name: needle }, { page: 1, limit: 20 });
    expect(res.data.map((i) => i.name)).toEqual(expected);
    expect(res.total).toBe(expected.length);
    expect(res.data).toHaveLength(expected.length);
  });

  it('findByNameAndLocation is case-insensitive', async () => {
    const found = await repo.findByNameAndLocation(USER, 'aPPLE', 'FRIDGE');
    expect(found?.name).toBe('Apple');
    expect(await repo.findByNameAndLocation(USER, 'apple', 'FREEZER')).toBeNull();
  });
});
