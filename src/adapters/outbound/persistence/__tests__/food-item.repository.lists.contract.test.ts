import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryFoodItemRepository } from '../food-item.in-memory.repository.js';
import { SqliteFoodItemRepository } from '../food-item.sqlite.repository.js';
import type { FoodItemRepositoryPort } from '../../../../core/ports/outbound/food-item.repository.port.js';
import type { FoodItem, FoodItemSortInput } from '../../../../core/domain/food-item.js';
import { ConflictError } from '../../../../core/domain/errors.js';

const USER = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '00000000-0000-4000-8000-0000000000bb';
let counter = 0;

const make = (overrides: Partial<FoodItem> = {}): FoodItem => {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    userId: USER,
    name: `Item ${counter}`,
    quantity: 1,
    unit: 'UNITS',
    location: 'FRIDGE',
    category: 'OTHER',
    bestBefore: new Date('2026-09-01T00:00:00.000Z'),
    addedAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
};

const P = { page: 1, limit: 50 };

describe.each([
  ['in-memory', () => new InMemoryFoodItemRepository() as FoodItemRepositoryPort & { close?: () => void }],
  ['sqlite', () => new SqliteFoodItemRepository(':memory:')],
])('FoodItemRepository lists, history, consume (%s)', (_label, factory) => {
  let repo: FoodItemRepositoryPort & { close?: () => void };

  beforeEach(() => {
    counter = 0;
    repo = factory();
  });
  afterEach(() => repo.close?.());

  describe('sorting', () => {
    beforeEach(async () => {
      await repo.save(make({ name: 'banana', quantity: 3, bestBefore: new Date('2026-09-03'), addedAt: new Date('2026-08-03') }));
      await repo.save(make({ name: 'Apple', quantity: 1, bestBefore: new Date('2026-09-01'), addedAt: new Date('2026-08-02') }));
      await repo.save(make({ name: 'cherry', quantity: 2, bestBefore: new Date('2026-09-02'), addedAt: new Date('2026-08-01') }));
      await repo.save(make({ name: 'Date', quantity: 2, bestBefore: new Date('2026-09-02'), addedAt: new Date('2026-08-04') }));
    });

    it.each([
      [{ sort: 'bestBefore', order: 'asc' }, ['Apple', 'cherry', 'Date', 'banana']],
      [{ sort: 'bestBefore', order: 'desc' }, ['banana', 'cherry', 'Date', 'Apple']],
      [{ sort: 'name', order: 'asc' }, ['Apple', 'banana', 'cherry', 'Date']],
      [{ sort: 'name', order: 'desc' }, ['Date', 'cherry', 'banana', 'Apple']],
      [{ sort: 'addedAt', order: 'asc' }, ['cherry', 'Apple', 'banana', 'Date']],
      [{ sort: 'addedAt', order: 'desc' }, ['Date', 'banana', 'Apple', 'cherry']],
      [{ sort: 'quantity', order: 'asc' }, ['Apple', 'cherry', 'Date', 'banana']],
      [{ sort: 'quantity', order: 'desc' }, ['banana', 'cherry', 'Date', 'Apple']],
    ] as Array<[FoodItemSortInput, string[]]>)('sorts by %j', async (sort, expected) => {
      const res = await repo.findAllPaginated(USER, {}, P, sort);
      expect(res.data.map((i) => i.name)).toEqual(expected);
      const all = await repo.findAll(USER, {}, sort);
      expect(all.map((i) => i.name)).toEqual(expected);
    });

    it('defaults to bestBefore asc', async () => {
      const res = await repo.findAllPaginated(USER, {}, P);
      expect(res.data.map((i) => i.name)).toEqual(['Apple', 'cherry', 'Date', 'banana']);
    });

    it('paginates stably with id tiebreaker', async () => {
      const sort: FoodItemSortInput = { sort: 'quantity', order: 'asc' };
      const p1 = await repo.findAllPaginated(USER, {}, { page: 1, limit: 2 }, sort);
      const p2 = await repo.findAllPaginated(USER, {}, { page: 2, limit: 2 }, sort);
      expect([...p1.data, ...p2.data].map((i) => i.name)).toEqual(['Apple', 'cherry', 'Date', 'banana']);
    });
  });

  describe('filters', () => {
    it('lowStock true/false incl. no minimum and equality boundary', async () => {
      await repo.save(make({ name: 'low', quantity: 1, minimumQuantity: 2 }));
      await repo.save(make({ name: 'equal', quantity: 2, minimumQuantity: 2 }));
      await repo.save(make({ name: 'none', quantity: 1 }));
      await repo.save(make({ name: 'zero-min', quantity: 1, minimumQuantity: 0 }));
      const t = await repo.findAllPaginated(USER, { lowStock: true }, P, { sort: 'name', order: 'asc' });
      expect(t.data.map((i) => i.name)).toEqual(['low']);
      const f = await repo.findAllPaginated(USER, { lowStock: false }, P, { sort: 'name', order: 'asc' });
      expect(f.data.map((i) => i.name)).toEqual(['equal', 'none', 'zero-min']);
    });

    it('expiringBefore is inclusive and includes expired', async () => {
      await repo.save(make({ name: 'past', bestBefore: new Date('2020-01-01') }));
      await repo.save(make({ name: 'edge', bestBefore: new Date('2026-09-10T00:00:00.000Z') }));
      await repo.save(make({ name: 'after', bestBefore: new Date('2026-09-10T00:00:00.001Z') }));
      const res = await repo.findAllPaginated(USER, { expiringBefore: new Date('2026-09-10T00:00:00.000Z') }, P);
      expect(res.data.map((i) => i.name)).toEqual(['past', 'edge']);
    });

    it('status relative to a fixed now', async () => {
      const now = new Date('2026-10-01T00:00:00.000Z');
      await repo.save(make({ name: 'expired', bestBefore: new Date('2026-09-30T23:59:59.999Z') }));
      await repo.save(make({ name: 'at-now', bestBefore: new Date('2026-10-01T00:00:00.000Z') }));
      await repo.save(make({ name: 'at-limit', bestBefore: new Date('2026-10-04T00:00:00.000Z') }));
      await repo.save(make({ name: 'fresh', bestBefore: new Date('2026-10-04T00:00:00.001Z') }));
      const run = async (status: 'expired' | 'expiring' | 'fresh') =>
        (await repo.findAllPaginated(USER, { status, now, expiringWithinDays: 3 }, P)).data.map((i) => i.name);
      expect(await run('expired')).toEqual(['expired']);
      expect(await run('expiring')).toEqual(['at-now', 'at-limit']);
      expect(await run('fresh')).toEqual(['fresh']);
    });

    it('combines filters', async () => {
      await repo.save(make({ name: 'a', location: 'FRIDGE', quantity: 1, minimumQuantity: 5 }));
      await repo.save(make({ name: 'b', location: 'PANTRY', quantity: 1, minimumQuantity: 5 }));
      await repo.save(make({ name: 'c', location: 'FRIDGE', quantity: 9, minimumQuantity: 5 }));
      const res = await repo.findAllPaginated(USER, { location: 'FRIDGE', lowStock: true }, P);
      expect(res.data.map((i) => i.name)).toEqual(['a']);
    });

    it.each([
      [0, 20, 0],
      [1, 20, 1],
      [4, 2, 2],
      [5, 2, 3],
    ])('totalPages for %i items, limit %i -> %i', async (n, limit, pages) => {
      for (let i = 0; i < n; i++) await repo.save(make());
      const res = await repo.findAllPaginated(USER, {}, { page: 1, limit });
      expect(res.total).toBe(n);
      expect(res.totalPages).toBe(pages);
    });

    it('excludes disposed items and other users', async () => {
      const a = await repo.save(make({ name: 'a' }));
      await repo.save(make({ name: 'b', userId: OTHER }));
      await repo.dispose(a.id, USER, 'CONSUMED');
      const res = await repo.findAllPaginated(USER, {}, P);
      expect(res.total).toBe(0);
    });
  });

  describe('consume', () => {
    it('decrements active items and bumps updatedAt', async () => {
      const item = await repo.save(make({ quantity: 5, minimumQuantity: 2, notes: 'n' }));
      const res = await repo.consume(item.id, USER, 2);
      expect(res?.quantity).toBe(3);
      expect(res?.disposition).toBeUndefined();
      expect(res?.minimumQuantity).toBe(2);
      expect(res?.notes).toBe('n');
      expect(res!.updatedAt.getTime()).toBeGreaterThan(item.updatedAt.getTime());
      expect((await repo.findById(item.id, USER))?.quantity).toBe(3);
    });

    it.each([5, 9])('amount %i >= quantity 5 disposes as CONSUMED', async (amount) => {
      const item = await repo.save(make({ quantity: 5 }));
      const res = await repo.consume(item.id, USER, amount);
      expect(res?.disposition).toBe('CONSUMED');
      expect(res?.disposedAt).toBeInstanceOf(Date);
      expect(res?.quantity).toBe(5);
      expect(await repo.findById(item.id, USER)).toBeNull();
    });

    it('returns null for other user, unknown, already disposed', async () => {
      const item = await repo.save(make({ quantity: 5 }));
      expect(await repo.consume(item.id, OTHER, 1)).toBeNull();
      expect(await repo.consume('00000000-0000-4000-8000-ffffffffffff', USER, 1)).toBeNull();
      await repo.dispose(item.id, USER, 'DISCARDED');
      expect(await repo.consume(item.id, USER, 1)).toBeNull();
    });

    it('rounds float noise', async () => {
      const item = await repo.save(make({ quantity: 0.3 }));
      expect((await repo.consume(item.id, USER, 0.1))?.quantity).toBe(0.2);
    });

    it('disposes when the rounded remainder is <= 0', async () => {
      const item = await repo.save(make({ quantity: 1.0000004 }));
      const res = await repo.consume(item.id, USER, 1);
      expect(res?.disposition).toBe('CONSUMED');
      expect(await repo.findById(item.id, USER)).toBeNull();
    });

    it('status boundaries are exact 24h multiples across a DST change', async () => {
      const now = new Date('2026-03-28T12:00:00.000Z');
      const edge = new Date(now.getTime() + 3 * 86_400_000);
      await repo.save(make({ name: 'edge', bestBefore: edge }));
      await repo.save(make({ name: 'past', bestBefore: new Date(edge.getTime() + 1) }));
      const run = async (status: 'expiring' | 'fresh') =>
        (await repo.findAllPaginated(USER, { status, now, expiringWithinDays: 3 }, P)).data.map((i) => i.name);
      expect(await run('expiring')).toEqual(['edge']);
      expect(await run('fresh')).toEqual(['past']);
    });

    it('concurrent consumes never go negative', async () => {
      const item = await repo.save(make({ quantity: 2 }));
      const results = await Promise.all([1, 2, 3].map(() => repo.consume(item.id, USER, 1)));
      expect(results.filter(Boolean)).toHaveLength(2);
      expect(await repo.findById(item.id, USER)).toBeNull();
      const disposed = await repo.findDisposedById(item.id, USER);
      expect(disposed?.disposition).toBe('CONSUMED');
      expect(disposed!.quantity).toBeGreaterThan(0);
    });
  });

  describe('disposal history', () => {
    const disposeAt = async (item: FoodItem, outcome: 'CONSUMED' | 'DISCARDED', at: string) => {
      await repo.save(item);
      await repo.dispose(item.id, item.userId, outcome);
      // Force a deterministic disposedAt by re-saving through the port-specific escape hatches.
      const sqlite = repo as unknown as { getConnection?: () => import('better-sqlite3').Database };
      if (sqlite.getConnection) {
        sqlite.getConnection().prepare('UPDATE food_items SET disposed_at = ? WHERE id = ?').run(new Date(at).toISOString(), item.id);
      } else {
        const found = await repo.findDisposedById(item.id, item.userId);
        await repo.save({ ...found!, disposedAt: new Date(at) });
      }
    };

    beforeEach(async () => {
      await disposeAt(make({ name: 'a', category: 'DAIRY' }), 'CONSUMED', '2026-08-10T00:00:00Z');
      await disposeAt(make({ name: 'b', category: 'DAIRY' }), 'DISCARDED', '2026-09-05T00:00:00Z');
      await disposeAt(make({ name: 'c', category: 'MEAT' }), 'DISCARDED', '2026-09-20T00:00:00Z');
      await disposeAt(make({ name: 'x', userId: OTHER }), 'DISCARDED', '2026-09-20T00:00:00Z');
      await repo.save(make({ name: 'active' }));
    });

    it('orders by disposedAt desc and paginates', async () => {
      const p1 = await repo.findDisposedPaginated(USER, {}, { page: 1, limit: 2 });
      expect(p1.data.map((i) => i.name)).toEqual(['c', 'b']);
      expect(p1.total).toBe(3);
      expect(p1.totalPages).toBe(2);
      const p2 = await repo.findDisposedPaginated(USER, {}, { page: 2, limit: 2 });
      expect(p2.data.map((i) => i.name)).toEqual(['a']);
    });

    it('filters by outcome and inclusive dates', async () => {
      expect((await repo.findDisposedPaginated(USER, { outcome: 'CONSUMED' }, P)).data.map((i) => i.name)).toEqual(['a']);
      const ranged = await repo.findDisposedPaginated(
        USER,
        { from: new Date('2026-09-05T00:00:00Z'), to: new Date('2026-09-20T00:00:00Z') },
        P,
      );
      expect(ranged.data.map((i) => i.name)).toEqual(['c', 'b']);
    });

    it('groups stats by category and UTC month', async () => {
      const rows = await repo.getDisposalStats(USER, {
        from: new Date('2026-08-01T00:00:00Z'),
        to: new Date('2026-09-30T00:00:00Z'),
      });
      const key = (r: { category: string; month: string }) => `${r.month}/${r.category}`;
      const sorted = [...rows].sort((x, y) => key(x).localeCompare(key(y)));
      expect(sorted).toEqual([
        { category: 'DAIRY', month: '2026-08', consumed: 1, discarded: 0 },
        { category: 'DAIRY', month: '2026-09', consumed: 0, discarded: 1 },
        { category: 'MEAT', month: '2026-09', consumed: 0, discarded: 1 },
      ]);
    });

    it('purges only disposed rows older than the cutoff (all users)', async () => {
      const count = await repo.purgeDisposedBefore(new Date('2026-09-10T00:00:00Z'));
      expect(count).toBe(2);
      expect((await repo.findDisposedPaginated(USER, {}, P)).total).toBe(1);
      expect((await repo.findAllPaginated(USER, {}, P)).total).toBe(1);
    });

    it('restore reactivates, keeps bestBefore, and is user scoped', async () => {
      const [first] = (await repo.findDisposedPaginated(USER, {}, P)).data;
      expect(await repo.restore(first.id, OTHER)).toBeNull();
      const restored = await repo.restore(first.id, USER);
      expect(restored?.disposition).toBeUndefined();
      expect(restored?.disposedAt).toBeUndefined();
      expect(restored?.bestBefore).toEqual(first.bestBefore);
      expect(await repo.findById(first.id, USER)).not.toBeNull();
      expect(await repo.restore(first.id, USER)).toBeNull();
    });

    it('restore throws ConflictError when an active duplicate exists', async () => {
      const [first] = (await repo.findDisposedPaginated(USER, {}, P)).data;
      await repo.save(make({ name: first.name.toUpperCase(), location: first.location }));
      await expect(repo.restore(first.id, USER)).rejects.toBeInstanceOf(ConflictError);
      expect(await repo.findDisposedById(first.id, USER)).not.toBeNull();
    });
  });
});
