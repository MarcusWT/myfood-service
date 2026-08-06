import { z } from 'zod';
import { LocationSchema, CategorySchema, UnitSchema } from './value-objects.js';

const MAX_QUANTITY = 100_000;

export const FoodItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(MAX_QUANTITY),
  unit: UnitSchema,
  location: LocationSchema,
  category: CategorySchema,
  bestBefore: z.coerce.date(),
  addedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;

export const CreateFoodItemSchema = FoodItemSchema.omit({
  id: true,
  addedAt: true,
  updatedAt: true,
}).refine((data) => data.bestBefore.getTime() > Date.now(), {
  message: 'bestBefore must be a future date',
  path: ['bestBefore'],
});
export type CreateFoodItemInput = z.infer<typeof CreateFoodItemSchema>;

export const UpdateFoodItemSchema = FoodItemSchema.omit({
  id: true,
  addedAt: true,
  updatedAt: true,
})
  .partial()
  .refine((data) => data.bestBefore === undefined || data.bestBefore.getTime() > Date.now(), {
    message: 'bestBefore must be a future date',
    path: ['bestBefore'],
  });
export type UpdateFoodItemInput = z.infer<typeof UpdateFoodItemSchema>;

export const FoodItemFilterSchema = z.object({
  location: LocationSchema.optional(),
  category: CategorySchema.optional(),
  name: z.string().trim().max(200).optional(),
});
export type FoodItemFilter = z.infer<typeof FoodItemFilterSchema>;

/**
 * Determines if a food item is expired relative to the given date.
 */
export function isExpired(item: FoodItem, now: Date = new Date()): boolean {
  return item.bestBefore < now;
}

/**
 * Determines if a food item is expiring within the given number of days.
 */
export function isExpiringSoon(
  item: FoodItem,
  withinDays: number,
  now: Date = new Date(),
): boolean {
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + withinDays);
  return item.bestBefore <= threshold && item.bestBefore >= now;
}
