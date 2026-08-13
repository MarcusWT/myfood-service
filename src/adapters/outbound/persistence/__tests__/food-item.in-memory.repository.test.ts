import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFoodItemRepository } from '../food-item.in-memory.repository.js';
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

describe('InMemoryFoodItemRepository', () => {
  let repo: InMemoryFoodItemRepository;

  beforeEach(() => {
    repo = new InMemoryFoodItemRepository();
  });

  describe('save / findById', () => {
    it('saves an item and finds it by id', async () => {
      const item = makeItem();
      await repo.save(item);

      const found = await repo.findById(item.id);
      expect(found).toEqual(item);
    });

    it('returns null for a missing id', async () => {
      const found = await repo.findById('missing-id');
      expect(found).toBeNull();
    });

    it('does not leak mutations back into the stored item', async () => {
      const item = makeItem();
      await repo.save(item);

      item.name = 'Mutated';

      const found = await repo.findById(item.id);
      expect(found?.name).toBe('Eggs');
    });
  });

  describe('findAll', () => {
    it('returns all items sorted by bestBefore ascending', async () => {
      const later = makeItem({
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Milk',
        bestBefore: new Date('2026-10-01'),
      });
      const sooner = makeItem({
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Yoghurt',
        bestBefore: new Date('2026-08-15'),
      });
      await repo.save(later);
      await repo.save(sooner);

      const results = await repo.findAll();
      expect(results.map((i) => i.id)).toEqual([sooner.id, later.id]);
    });

    it('filters by location', async () => {
      const fridgeItem = makeItem({ id: '00000000-0000-0000-0000-000000000004', location: 'FRIDGE' });
      const freezerItem = makeItem({ id: '00000000-0000-0000-0000-000000000005', location: 'FREEZER' });
      await repo.save(fridgeItem);
      await repo.save(freezerItem);

      const results = await repo.findAll({ location: 'FREEZER' });
      expect(results).toEqual([freezerItem]);
    });

    it('filters by category', async () => {
      const dairy = makeItem({ id: '00000000-0000-0000-0000-000000000006', category: 'DAIRY' });
      const meat = makeItem({ id: '00000000-0000-0000-0000-000000000007', category: 'MEAT' });
      await repo.save(dairy);
      await repo.save(meat);

      const results = await repo.findAll({ category: 'MEAT' });
      expect(results).toEqual([meat]);
    });

    it('filters by name with a case-insensitive partial match', async () => {
      const eggs = makeItem({ id: '00000000-0000-0000-0000-000000000008', name: 'Free Range Eggs' });
      const milk = makeItem({ id: '00000000-0000-0000-0000-000000000009', name: 'Oat Milk' });
      await repo.save(eggs);
      await repo.save(milk);

      const results = await repo.findAll({ name: 'egg' });
      expect(results).toEqual([eggs]);
    });
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

  describe('update', () => {
    it('merges the input into the existing item and bumps updatedAt', async () => {
      const item = makeItem();
      await repo.save(item);

      const updated = await repo.update(item.id, { quantity: 6 });

      expect(updated).not.toBeNull();
      expect(updated?.quantity).toBe(6);
      expect(updated?.name).toBe(item.name);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(item.updatedAt.getTime());
    });

    it('returns null when the item does not exist', async () => {
      const updated = await repo.update('missing-id', { quantity: 6 });
      expect(updated).toBeNull();
    });

    it('round-trips minimumQuantity through save and update', async () => {
      const item = makeItem({ minimumQuantity: 6 });
      await repo.save(item);

      const found = await repo.findById(item.id);
      expect(found?.minimumQuantity).toBe(6);

      const updated = await repo.update(item.id, { minimumQuantity: 2 });
      expect(updated?.minimumQuantity).toBe(2);
    });
  });

  describe('delete', () => {
    it('removes an existing item and returns true', async () => {
      const item = makeItem();
      await repo.save(item);

      await expect(repo.delete(item.id)).resolves.toBe(true);
      await expect(repo.findById(item.id)).resolves.toBeNull();
    });

    it('returns false when the item does not exist', async () => {
      await expect(repo.delete('missing-id')).resolves.toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all stored items', async () => {
      await repo.save(makeItem());
      repo.clear();

      const results = await repo.findAll();
      expect(results).toEqual([]);
    });
  });

  describe('isolation between instances', () => {
    it('does not share state across instances', async () => {
      const other = new InMemoryFoodItemRepository();
      await repo.save(makeItem());

      const results = await other.findAll();
      expect(results).toEqual([]);
    });
  });
});
