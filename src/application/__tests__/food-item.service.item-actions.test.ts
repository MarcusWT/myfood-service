import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FoodItemService, NotFoundError, ConflictError } from '../food-item.service.js';
import type { FoodItemRepositoryPort } from '../../core/ports/outbound/food-item.repository.port.js';
import type { FoodItem } from '../../core/domain/food-item.js';

const USER = 'user-1';
const item = (o?: Partial<FoodItem>): FoodItem => ({
  id: '00000000-0000-0000-0000-000000000001',
  userId: USER,
  name: 'Eggs',
  quantity: 4,
  unit: 'UNITS',
  location: 'FRIDGE',
  category: 'OTHER',
  bestBefore: new Date('2026-09-01'),
  addedAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  ...o,
});

describe('FoodItemService list sort, consume, restore', () => {
  let repo: { [K in keyof FoodItemRepositoryPort]: ReturnType<typeof vi.fn> };
  let service: FoodItemService;

  beforeEach(() => {
    repo = {
      save: vi.fn(), findById: vi.fn(), findAll: vi.fn(), findAllPaginated: vi.fn(),
      findByNameAndLocation: vi.fn(), update: vi.fn(), dispose: vi.fn(), consume: vi.fn(),
      findDisposedPaginated: vi.fn(), findDisposedById: vi.fn(), restore: vi.fn(),
      getDisposalStats: vi.fn(), purgeDisposedBefore: vi.fn(), delete: vi.fn(),
    };
    service = new FoodItemService(repo as unknown as FoodItemRepositoryPort, 5);
  });

  it('passes sort through', async () => {
    const sort = { sort: 'name', order: 'desc' } as const;
    await service.listItemsPaginated(USER, {}, { page: 1, limit: 20 }, sort);
    expect(repo.findAllPaginated).toHaveBeenCalledWith(USER, {}, { page: 1, limit: 20 }, sort);
  });

  it('fills default expiring days only when status is set', async () => {
    await service.listItemsPaginated(USER, { status: 'expiring' }, { page: 1, limit: 20 });
    expect(repo.findAllPaginated.mock.calls[0][1]).toEqual({ status: 'expiring', expiringWithinDays: 5 });
    await service.listItemsPaginated(USER, {}, { page: 1, limit: 20 });
    expect(repo.findAllPaginated.mock.calls[1][1]).toEqual({});
  });

  describe('consumeItem', () => {
    it('throws NotFoundError when repo returns null', async () => {
      repo.consume.mockResolvedValue(null);
      await expect(service.consumeItem('x', USER, 1)).rejects.toBeInstanceOf(NotFoundError);
    });

    it.each([
      [item({ quantity: 1, minimumQuantity: 2 }), true],
      [item({ quantity: 2, minimumQuantity: 2 }), false],
      [item({ quantity: 1 }), false],
    ])('lowStock flag %#', async (it_, lowStock) => {
      repo.consume.mockResolvedValue(it_);
      expect(await service.consumeItem('x', USER, 1)).toEqual({ item: it_, disposed: false, lowStock });
    });

    it('disposed items report disposed true and lowStock false', async () => {
      const d = item({ quantity: 1, minimumQuantity: 5, disposition: 'CONSUMED', disposedAt: new Date() });
      repo.consume.mockResolvedValue(d);
      expect(await service.consumeItem('x', USER, 5)).toEqual({ item: d, disposed: true, lowStock: false });
    });
  });

  describe('restoreItem', () => {
    const disposed = item({ disposition: 'DISCARDED', disposedAt: new Date() });

    it('restores', async () => {
      repo.findDisposedById.mockResolvedValue(disposed);
      repo.findByNameAndLocation.mockResolvedValue(null);
      repo.restore.mockResolvedValue(item());
      expect(await service.restoreItem(disposed.id, USER)).toEqual(item());
    });

    it('NotFound when no disposed item (active or other user)', async () => {
      repo.findDisposedById.mockResolvedValue(null);
      await expect(service.restoreItem('x', USER)).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.restore).not.toHaveBeenCalled();
    });

    it('Conflict when active duplicate exists', async () => {
      repo.findDisposedById.mockResolvedValue(disposed);
      repo.findByNameAndLocation.mockResolvedValue(item({ id: 'other' }));
      await expect(service.restoreItem(disposed.id, USER)).rejects.toThrow(ConflictError);
      expect(repo.restore).not.toHaveBeenCalled();
    });
  });
});
