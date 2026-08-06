import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FoodItemService, NotFoundError } from '../food-item.service.js';
import type { FoodItemRepositoryPort } from '../../core/ports/outbound/food-item.repository.port.js';
import type { FoodItem } from '../../core/domain/food-item.js';

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

function makeMockRepository(): FoodItemRepositoryPort {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findAllPaginated: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

describe('FoodItemService', () => {
  let repo: FoodItemRepositoryPort;
  let service: FoodItemService;

  beforeEach(() => {
    repo = makeMockRepository();
    service = new FoodItemService(repo);
  });

  describe('addItem', () => {
    it('saves and returns a new food item with generated id', async () => {
      const input = {
        name: 'Eggs',
        quantity: 12,
        unit: 'UNITS' as const,
        location: 'FRIDGE' as const,
        category: 'OTHER' as const,
        bestBefore: new Date('2026-09-01'),
      };
      const expected = makeItem();
      vi.mocked(repo.save).mockResolvedValue(expected);

      const result = await service.addItem(input);

      expect(repo.save).toHaveBeenCalledOnce();
      expect(result).toEqual(expected);
    });
  });

  describe('getItem', () => {
    it('returns item when found', async () => {
      const item = makeItem();
      vi.mocked(repo.findById).mockResolvedValue(item);

      const result = await service.getItem(item.id);
      expect(result).toEqual(item);
    });

    it('throws NotFoundError when item does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.getItem('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('removeItem', () => {
    it('resolves when item is deleted', async () => {
      vi.mocked(repo.delete).mockResolvedValue(true);
      await expect(service.removeItem('some-id')).resolves.toBeUndefined();
    });

    it('throws NotFoundError when item does not exist', async () => {
      vi.mocked(repo.delete).mockResolvedValue(false);
      await expect(service.removeItem('missing-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listItemsPaginated', () => {
    it('delegates to the repository and returns its result', async () => {
      const expected = { data: [makeItem()], total: 1, page: 1, limit: 20 };
      vi.mocked(repo.findAllPaginated).mockResolvedValue(expected);

      const result = await service.listItemsPaginated({}, { page: 1, limit: 20 });

      expect(repo.findAllPaginated).toHaveBeenCalledWith({}, { page: 1, limit: 20 });
      expect(result).toEqual(expected);
    });
  });
});
