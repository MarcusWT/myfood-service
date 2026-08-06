import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteFoodItemRepository } from '../food-item.sqlite.repository.js';
import type { FoodItem } from '../../../../core/domain/food-item.js';

const makeItem = (overrides?: Partial<FoodItem>): FoodItem => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Eggs',
  quantity: 12,
  unit: 'UNITS',
  location: 'FRIDGE',
  category: 'OTHER',
  bestBefore: new Date('2026-09-01'),
  addedAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  ...overrides,
});

describe('SqliteFoodItemRepository', () => {
  let repo: SqliteFoodItemRepository;

  beforeEach(() => {
    repo = new SqliteFoodItemRepository(':memory:');
  });

  afterEach(() => {
    repo.close();
  });

  describe('findAllPaginated', () => {
    it('returns a page of results sorted by bestBefore ascending', async () => {
      for (let i = 0; i < 5; i += 1) {
        await repo.save(
          makeItem({
            id: `00000000-0000-0000-0000-0000000001${i}`,
            name: `Item ${i}`,
            bestBefore: new Date(`2026-08-${10 + i}`),
          }),
        );
      }

      const result = await repo.findAllPaginated({}, { page: 1, limit: 2 });

      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Item 0');
      expect(result.data[1].name).toBe('Item 1');
    });

    it('returns the correct slice for later pages', async () => {
      for (let i = 0; i < 5; i += 1) {
        await repo.save(
          makeItem({
            id: `00000000-0000-0000-0000-0000000002${i}`,
            name: `Item ${i}`,
            bestBefore: new Date(`2026-08-${10 + i}`),
          }),
        );
      }

      const result = await repo.findAllPaginated({}, { page: 3, limit: 2 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Item 4');
    });

    it('applies filters before paginating, reporting the filtered total', async () => {
      await repo.save(makeItem({ id: '00000000-0000-0000-0000-000000000030', location: 'FRIDGE' }));
      await repo.save(makeItem({ id: '00000000-0000-0000-0000-000000000031', location: 'FREEZER' }));
      await repo.save(makeItem({ id: '00000000-0000-0000-0000-000000000032', location: 'FREEZER' }));

      const result = await repo.findAllPaginated({ location: 'FREEZER' }, { page: 1, limit: 1 });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(1);
    });

    it('returns an empty data array when the page is beyond the available results', async () => {
      await repo.save(makeItem());

      const result = await repo.findAllPaginated({}, { page: 5, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(1);
    });
  });

  describe('findByNameAndLocation', () => {
    it('finds a case-insensitive match in the same location', async () => {
      const item = makeItem({ name: 'Eggs', location: 'FRIDGE' });
      await repo.save(item);

      const found = await repo.findByNameAndLocation('eggs', 'FRIDGE');
      expect(found?.id).toBe(item.id);
    });

    it('returns null when the name matches but the location differs', async () => {
      await repo.save(makeItem({ name: 'Eggs', location: 'FRIDGE' }));

      const found = await repo.findByNameAndLocation('Eggs', 'PANTRY');
      expect(found).toBeNull();
    });

    it('excludes the given id', async () => {
      const item = makeItem({ name: 'Eggs', location: 'FRIDGE' });
      await repo.save(item);

      const found = await repo.findByNameAndLocation('Eggs', 'FRIDGE', item.id);
      expect(found).toBeNull();
    });
  });
});
