import { describe, it, expect } from 'vitest';
import { ConsumeFoodItemSchema, FoodItemFilterSchema, FoodItemListQuerySchema } from '../food-item.js';
import { HistoryFilterSchema } from '../disposal-history.js';
import { PaginationSchema, paginate } from '../pagination.js';

describe('ConsumeFoodItemSchema', () => {
  it.each([[{ amount: 0 }], [{ amount: -1 }], [{ amount: '1' }], [{}], [{ amount: 1, x: 1 }], [{ amount: 100_001 }]])(
    'rejects %j',
    (v) => expect(ConsumeFoodItemSchema.safeParse(v).success).toBe(false),
  );
  it('accepts decimals', () => expect(ConsumeFoodItemSchema.parse({ amount: 0.25 })).toEqual({ amount: 0.25 }));
});

describe('list query schemas', () => {
  it('parses lowStock strings without coercion pitfalls', () => {
    expect(FoodItemFilterSchema.parse({ lowStock: 'false' }).lowStock).toBe(false);
    expect(FoodItemFilterSchema.parse({ lowStock: 'true' }).lowStock).toBe(true);
    expect(FoodItemFilterSchema.safeParse({ lowStock: 'yes' }).success).toBe(false);
  });
  it('defaults sort/order and rejects invalid', () => {
    expect(FoodItemListQuerySchema.parse({})).toEqual({ sort: 'bestBefore', order: 'asc' });
    expect(FoodItemListQuerySchema.safeParse({ sort: 'name;DROP' }).success).toBe(false);
  });
  it('pagination limits and totalPages helper', () => {
    expect(PaginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(PaginationSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(paginate([], 0, { page: 1, limit: 10 }).totalPages).toBe(0);
    expect(paginate([], 11, { page: 1, limit: 10 }).totalPages).toBe(2);
  });
  it('history filter rejects from > to', () => {
    expect(HistoryFilterSchema.safeParse({ from: '2026-02-01', to: '2026-01-01' }).success).toBe(false);
  });
});
