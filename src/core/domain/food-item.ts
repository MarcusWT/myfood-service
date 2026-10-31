import { z } from 'zod';
import { LocationSchema, CategorySchema, UnitSchema } from './value-objects.js';

const MAX_QUANTITY = 100_000;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;

function parseStrictIsoDate(value: string): Date | null {
  const dateOnly = DATE_ONLY_RE.exec(value);
  if (dateOnly) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10) === value ? date : null;
  }
  if (DATE_TIME_RE.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Strict ISO-8601 date: `YYYY-MM-DD` (interpreted as UTC midnight) or a full
 * datetime with `Z`/offset. Numbers, null and loose formats are rejected.
 */
export const StrictIsoDateSchema = z
  .string()
  .transform((value, ctx) => {
    const date = parseStrictIsoDate(value);
    if (!date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'bestBefore must be an ISO 8601 date (YYYY-MM-DD) or datetime with timezone',
      });
      return z.NEVER;
    }
    return date;
  });

export const DisposalOutcomeSchema = z.enum(['CONSUMED', 'DISCARDED']);
export type DisposalOutcome = z.infer<typeof DisposalOutcomeSchema>;

export const DisposeFoodItemSchema = z.object({ outcome: DisposalOutcomeSchema });
export type DisposeFoodItemInput = z.infer<typeof DisposeFoodItemSchema>;

export const FoodItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  // Must be > 0; to record that an item ran out, dispose it as CONSUMED.
  quantity: z.number().positive().max(MAX_QUANTITY),
  unit: UnitSchema,
  location: LocationSchema,
  category: CategorySchema,
  bestBefore: z.coerce.date(),
  addedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
  minimumQuantity: z.number().nonnegative().max(MAX_QUANTITY).optional(),
  disposition: DisposalOutcomeSchema.optional(),
  disposedAt: z.coerce.date().optional(),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;

export const CreateFoodItemSchema = FoodItemSchema.omit({
  id: true,
  userId: true,
  addedAt: true,
  updatedAt: true,
  disposition: true,
  disposedAt: true,
})
  .extend({ bestBefore: StrictIsoDateSchema })
  .refine((data) => !(data.bestBefore instanceof Date) || data.bestBefore.getTime() > Date.now(), {
  message: 'bestBefore must be a future date',
  path: ['bestBefore'],
});
export type CreateFoodItemInput = z.infer<typeof CreateFoodItemSchema>;

export const UpdateFoodItemSchema = FoodItemSchema.omit({
  id: true,
  userId: true,
  addedAt: true,
  updatedAt: true,
  disposition: true,
  disposedAt: true,
})
  .extend({
    bestBefore: StrictIsoDateSchema,
    notes: FoodItemSchema.shape.notes.nullable().optional(),
    minimumQuantity: FoodItemSchema.shape.minimumQuantity.nullable().optional(),
  })
  .partial();
export type UpdateFoodItemInput = z.infer<typeof UpdateFoodItemSchema>;

/**
 * Applies a partial update: `undefined` means unchanged, `null` for
 * `notes`/`minimumQuantity` clears the field.
 */
export function applyUpdate(existing: FoodItem, input: UpdateFoodItemInput, now: Date): FoodItem {
  const { notes, minimumQuantity, ...rest } = input;
  const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  const updated: FoodItem = { ...existing, ...defined, updatedAt: now };
  if (notes === null) delete updated.notes;
  else if (notes !== undefined) updated.notes = notes;
  if (minimumQuantity === null) delete updated.minimumQuantity;
  else if (minimumQuantity !== undefined) updated.minimumQuantity = minimumQuantity;
  return updated;
}

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

/**
 * Determines if a food item's quantity has fallen below its user-defined minimum.
 * Items without a `minimumQuantity` set are never considered low stock.
 */
export function isLowStock(item: FoodItem): boolean {
  return item.minimumQuantity !== undefined && item.quantity < item.minimumQuantity;
}
