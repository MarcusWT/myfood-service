import { describe, it, expect } from 'vitest';
import { isExpired, isExpiringSoon, CreateFoodItemSchema, UpdateFoodItemSchema } from '../food-item.js';
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

const validCreateInput = {
  name: 'Milk',
  quantity: 1,
  unit: 'LITRES' as const,
  location: 'FRIDGE' as const,
  category: 'DAIRY' as const,
  bestBefore: new Date(Date.now() + 24 * 60 * 60 * 1000),
};

describe('CreateFoodItemSchema', () => {
  it('trims leading/trailing whitespace from name', () => {
    const result = CreateFoodItemSchema.parse({ ...validCreateInput, name: '  Milk  ' });
    expect(result.name).toBe('Milk');
  });

  it('trims leading/trailing whitespace from notes', () => {
    const result = CreateFoodItemSchema.parse({ ...validCreateInput, notes: '  fresh  ' });
    expect(result.notes).toBe('fresh');
  });

  it('rejects a bestBefore date in the past', () => {
    expect(() =>
      CreateFoodItemSchema.parse({ ...validCreateInput, bestBefore: new Date('2020-01-01') }),
    ).toThrow();
  });

  it('rejects a quantity above the maximum', () => {
    expect(() => CreateFoodItemSchema.parse({ ...validCreateInput, quantity: 200_000 })).toThrow();
  });

  it('accepts a valid input', () => {
    expect(() => CreateFoodItemSchema.parse(validCreateInput)).not.toThrow();
  });
});

describe('UpdateFoodItemSchema', () => {
  it('allows a partial update without bestBefore', () => {
    expect(() => UpdateFoodItemSchema.parse({ quantity: 5 })).not.toThrow();
  });

  it('rejects a bestBefore date in the past when provided', () => {
    expect(() => UpdateFoodItemSchema.parse({ bestBefore: new Date('2020-01-01') })).toThrow();
  });

  it('trims name when provided', () => {
    const result = UpdateFoodItemSchema.parse({ name: '  Eggs  ' });
    expect(result.name).toBe('Eggs');
  });
});
