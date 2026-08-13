import { describe, it, expect } from 'vitest';
import { buildShoppingSummary } from '../shopping-summary.js';
import type { FoodItem } from '../food-item.js';

const now = new Date('2026-08-13T00:00:00.000Z');

function makeItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Eggs',
    quantity: 12,
    unit: 'UNITS',
    location: 'FRIDGE',
    category: 'DAIRY',
    bestBefore: new Date('2026-09-01'),
    addedAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    ...overrides,
  };
}

describe('buildShoppingSummary', () => {
  it('returns an empty summary for no items', () => {
    const summary = buildShoppingSummary([], now);
    expect(summary.totalItems).toBe(0);
    expect(summary.byCategory).toEqual({});
  });

  it('flags an item as LOW_STOCK when quantity is below minimumQuantity and bestBefore is far in the future', () => {
    const item = makeItem({ quantity: 1, minimumQuantity: 6 });
    const summary = buildShoppingSummary([item], now);

    expect(summary.totalItems).toBe(1);
    expect(summary.byCategory.DAIRY[0]).toMatchObject({
      name: 'Eggs',
      reason: 'LOW_STOCK',
      currentQuantity: 1,
    });
  });

  it('does not flag an item as low stock when minimumQuantity is not set', () => {
    const item = makeItem({ quantity: 1 });
    const summary = buildShoppingSummary([item], now);
    expect(summary.totalItems).toBe(0);
  });

  it('does not flag an item as low stock when quantity is at or above minimumQuantity', () => {
    const item = makeItem({ quantity: 6, minimumQuantity: 6 });
    const summary = buildShoppingSummary([item], now);
    expect(summary.totalItems).toBe(0);
  });

  it('prefers EXPIRED reason over LOW_STOCK when an item is both expired and low stock', () => {
    const item = makeItem({
      quantity: 1,
      minimumQuantity: 6,
      bestBefore: new Date('2026-08-01'),
    });
    const summary = buildShoppingSummary([item], now);
    expect(summary.byCategory.DAIRY[0].reason).toBe('EXPIRED');
  });

  it('prefers EXPIRING_SOON reason over LOW_STOCK when an item is both expiring soon and low stock', () => {
    const item = makeItem({
      quantity: 1,
      minimumQuantity: 6,
      bestBefore: new Date('2026-08-14'),
    });
    const summary = buildShoppingSummary([item], now);
    expect(summary.byCategory.DAIRY[0].reason).toBe('EXPIRING_SOON');
  });

  it('groups items by category', () => {
    const dairy = makeItem({ quantity: 1, minimumQuantity: 6, category: 'DAIRY' });
    const produce = makeItem({
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Apples',
      quantity: 1,
      minimumQuantity: 6,
      category: 'FRUITS',
    });
    const summary = buildShoppingSummary([dairy, produce], now);
    expect(summary.totalItems).toBe(2);
    expect(Object.keys(summary.byCategory).sort()).toEqual(['DAIRY', 'FRUITS']);
  });
});
