import { z } from 'zod';

export const LocationSchema = z.enum(['FRIDGE', 'FREEZER', 'PANTRY']);
export type Location = z.infer<typeof LocationSchema>;

export const CategorySchema = z.enum([
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
]);
export type Category = z.infer<typeof CategorySchema>;

export const UnitSchema = z.enum([
  'GRAMS',
  'KILOGRAMS',
  'MILLILITRES',
  'LITRES',
  'UNITS',
  'SLICES',
  'PORTIONS',
]);
export type Unit = z.infer<typeof UnitSchema>;
