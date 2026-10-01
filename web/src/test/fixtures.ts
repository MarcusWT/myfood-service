import type { FoodItem } from '@/inventory/constants';

export const API = 'http://localhost:3000/api/v1';

export function makeItem(o: Partial<FoodItem> = {}): FoodItem {
  const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
  return {
    id: '11111111-1111-1111-1111-111111111111',
    userId: 'u1',
    name: 'Milk',
    quantity: 2,
    unit: 'LITRES',
    location: 'FRIDGE',
    category: 'DAIRY',
    bestBefore: future,
    addedAt: future,
    updatedAt: future,
    ...o,
  };
}

export const page = (data: FoodItem[], total = data.length) => ({
  data,
  total,
  page: 1,
  limit: 20,
});
