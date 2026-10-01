import type { components } from '@/api/schema';

export type FoodItem = components['schemas']['FoodItem'];
export type Location = FoodItem['location'];
export type Category = FoodItem['category'];
export type Unit = FoodItem['unit'];

export const LOCATIONS: Location[] = ['FRIDGE', 'FREEZER', 'PANTRY'];
export const CATEGORIES: Category[] = [
  'DAIRY',
  'MEAT',
  'SEAFOOD',
  'VEGETABLES',
  'FRUITS',
  'GRAINS',
  'CONDIMENTS',
  'BEVERAGES',
  'SNACKS',
  'FROZEN',
  'OTHER',
];
export const UNITS: Unit[] = [
  'GRAMS',
  'KILOGRAMS',
  'MILLILITRES',
  'LITRES',
  'UNITS',
  'SLICES',
  'PORTIONS',
];

export const label = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();

export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}
