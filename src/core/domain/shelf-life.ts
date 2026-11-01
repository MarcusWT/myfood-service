import { Category, Location } from './value-objects.js';

export type ShelfLifeDays = Record<Location, number | null>;

/** Default shelf life in days per category and location; null = not recommended. */
export const SHELF_LIFE_DAYS: Record<Category, ShelfLifeDays> = {
  DAIRY: { FRIDGE: 7, FREEZER: 90, PANTRY: null },
  MEAT: { FRIDGE: 3, FREEZER: 180, PANTRY: null },
  SEAFOOD: { FRIDGE: 2, FREEZER: 120, PANTRY: null },
  VEGETABLES: { FRIDGE: 7, FREEZER: 240, PANTRY: 5 },
  FRUITS: { FRIDGE: 7, FREEZER: 240, PANTRY: 5 },
  GRAINS: { FRIDGE: null, FREEZER: 180, PANTRY: 180 },
  CONDIMENTS: { FRIDGE: 90, FREEZER: null, PANTRY: 180 },
  BEVERAGES: { FRIDGE: 14, FREEZER: null, PANTRY: 180 },
  SNACKS: { FRIDGE: null, FREEZER: null, PANTRY: 60 },
  FROZEN: { FRIDGE: null, FREEZER: 180, PANTRY: null },
  OTHER: { FRIDGE: 5, FREEZER: 90, PANTRY: 30 },
};

export interface ShelfLifeSuggestion {
  category: Category;
  location: Location;
  days: number;
  suggestedBestBefore: Date;
  source: 'default-table';
}

export function suggestShelfLife(
  category: Category,
  location: Location,
  from: Date = new Date(),
): ShelfLifeSuggestion | null {
  const days = SHELF_LIFE_DAYS[category]?.[location];
  if (days === null || days === undefined) return null;
  const suggestedBestBefore = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + days),
  );
  return { category, location, days, suggestedBestBefore, source: 'default-table' };
}
