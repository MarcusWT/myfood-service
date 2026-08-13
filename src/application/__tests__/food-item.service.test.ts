import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FoodItemService, NotFoundError, ConflictError } from '../food-item.service.js';
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
    findByNameAndLocation: vi.fn(),
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
      vi.mocked(repo.findByNameAndLocation).mockResolvedValue(null);
      vi.mocked(repo.save).mockResolvedValue(expected);

      const result = await service.addItem(input);

      expect(repo.save).toHaveBeenCalledOnce();
      expect(result).toEqual(expected);
    });

    it('throws ConflictError when an item with the same name already exists in the location', async () => {
      const input = {
        name: 'Eggs',
        quantity: 12,
        unit: 'UNITS' as const,
        location: 'FRIDGE' as const,
        category: 'OTHER' as const,
        bestBefore: new Date('2026-09-01'),
      };
      vi.mocked(repo.findByNameAndLocation).mockResolvedValue(makeItem());

      await expect(service.addItem(input)).rejects.toThrow(ConflictError);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('passes minimumQuantity through to the repository when provided', async () => {
      const input = {
        name: 'Eggs',
        quantity: 12,
        minimumQuantity: 6,
        unit: 'UNITS' as const,
        location: 'FRIDGE' as const,
        category: 'OTHER' as const,
        bestBefore: new Date('2026-09-01'),
      };
      vi.mocked(repo.findByNameAndLocation).mockResolvedValue(null);
      vi.mocked(repo.save).mockImplementation(async (item) => item);

      const result = await service.addItem(input);

      expect(result.minimumQuantity).toBe(6);
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

  describe('updateItem', () => {
    it('throws NotFoundError when item does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.updateItem('missing-id', { quantity: 5 })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('updates when name/location are unchanged', async () => {
      const existing = makeItem();
      vi.mocked(repo.findById).mockResolvedValue(existing);
      vi.mocked(repo.update).mockResolvedValue({ ...existing, quantity: 3 });

      const result = await service.updateItem(existing.id, { quantity: 3 });

      expect(repo.findByNameAndLocation).not.toHaveBeenCalled();
      expect(result.quantity).toBe(3);
    });

    it('checks for conflicts when name changes and throws ConflictError on collision', async () => {
      const existing = makeItem();
      vi.mocked(repo.findById).mockResolvedValue(existing);
      vi.mocked(repo.findByNameAndLocation).mockResolvedValue(makeItem({ id: 'other-id' }));

      await expect(service.updateItem(existing.id, { name: 'Milk' })).rejects.toThrow(
        ConflictError,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows update when no conflicting item is found', async () => {
      const existing = makeItem();
      vi.mocked(repo.findById).mockResolvedValue(existing);
      vi.mocked(repo.findByNameAndLocation).mockResolvedValue(null);
      vi.mocked(repo.update).mockResolvedValue({ ...existing, name: 'Milk' });

      const result = await service.updateItem(existing.id, { name: 'Milk' });

      expect(repo.findByNameAndLocation).toHaveBeenCalledWith('Milk', existing.location, existing.id);
      expect(result.name).toBe('Milk');
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
