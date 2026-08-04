import { describe, it, expect } from 'vitest';
import { toExpiryAlert } from '../expiry-alert.js';
import type { FoodItem } from '../food-item.js';

const baseItem: FoodItem = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Cheese',
  quantity: 200,
  unit: 'GRAMS',
  location: 'FRIDGE',
  category: 'DAIRY',
  bestBefore: new Date('2026-08-10'),
  addedAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
};

describe('toExpiryAlert', () => {
  it('marks item as EXPIRED when past best before', () => {
    const alert = toExpiryAlert(baseItem, new Date('2026-08-12'));
    expect(alert.status).toBe('EXPIRED');
    expect(alert.daysUntilExpiry).toBeLessThan(0);
  });

  it('marks item as CRITICAL when expiring in 0–2 days', () => {
    const alert = toExpiryAlert(baseItem, new Date('2026-08-09'));
    expect(alert.status).toBe('CRITICAL');
  });

  it('marks item as WARNING when expiring in 3–5 days', () => {
    const alert = toExpiryAlert(baseItem, new Date('2026-08-06'));
    expect(alert.status).toBe('WARNING');
  });

  it('marks item as UPCOMING when expiring in 6+ days', () => {
    const alert = toExpiryAlert(baseItem, new Date('2026-08-01'));
    expect(alert.status).toBe('UPCOMING');
  });
});
