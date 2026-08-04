import { describe, it, expect } from 'vitest';
import { isExpired, isExpiringSoon } from '../food-item.js';
import type { FoodItem } from '../food-item.js';

const baseItem: FoodItem = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Milk',
  quantity: 1,
  unit: 'LITRES',
  location: 'FRIDGE',
  category: 'DAIRY',
  bestBefore: new Date('2026-08-10'),
  addedAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
};

describe('isExpired', () => {
  it('returns true when bestBefore is in the past', () => {
    const now = new Date('2026-08-11');
    expect(isExpired(baseItem, now)).toBe(true);
  });

  it('returns false when bestBefore is in the future', () => {
    const now = new Date('2026-08-09');
    expect(isExpired(baseItem, now)).toBe(false);
  });
});

describe('isExpiringSoon', () => {
  it('returns true when item expires within the threshold', () => {
    const now = new Date('2026-08-08');
    expect(isExpiringSoon(baseItem, 3, now)).toBe(true);
  });

  it('returns false when item expires beyond the threshold', () => {
    const now = new Date('2026-08-01');
    expect(isExpiringSoon(baseItem, 3, now)).toBe(false);
  });

  it('returns false for already expired items', () => {
    const now = new Date('2026-08-11');
    expect(isExpiringSoon(baseItem, 3, now)).toBe(false);
  });
});
