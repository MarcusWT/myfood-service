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

/**
 * Strict ISO date for range filters. A date-only value is start of that UTC
 * day, or its end (23:59:59.999Z) when `endOfDay` is set (upper bounds).
 */
export function dateBoundSchema(endOfDay: boolean) {
  return z.string().transform((value, ctx) => {
    const date = parseStrictIsoDate(value);
    if (!date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'must be an ISO 8601 date (YYYY-MM-DD) or datetime with timezone',
      });
      return z.NEVER;
    }
    return endOfDay && DATE_ONLY_RE.test(value) ? new Date(date.getTime() + 86_400_000 - 1) : date;
  });
}

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

export const FOOD_ITEM_SORT_FIELDS = ['bestBefore', 'name', 'addedAt', 'quantity'] as const;
export const FoodItemSortSchema = z.enum(FOOD_ITEM_SORT_FIELDS);
export type FoodItemSortField = z.infer<typeof FoodItemSortSchema>;
export const SortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof SortOrderSchema>;
export const FoodItemStatusSchema = z.enum(['expired', 'expiring', 'fresh']);
export type FoodItemStatus = z.infer<typeof FoodItemStatusSchema>;

export const FoodItemFilterSchema = z.object({
  location: LocationSchema.optional(),
  category: CategorySchema.optional(),
  name: z.string().trim().max(200).optional(),
  lowStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  expiringBefore: dateBoundSchema(true).optional(),
  status: FoodItemStatusSchema.optional(),
});
export type FoodItemFilter = z.infer<typeof FoodItemFilterSchema> & {
  /** Internal (not parsed from the query): reference time for `status`. Defaults to now. */
  now?: Date;
  /** Internal (not parsed from the query): window for `status=expiring|fresh`. */
  expiringWithinDays?: number;
};

export const FoodItemListQuerySchema = z.object({
  sort: FoodItemSortSchema.default('bestBefore'),
  order: SortOrderSchema.default('asc'),
});
export type FoodItemSortInput = z.infer<typeof FoodItemListQuerySchema>;

export const DEFAULT_FOOD_ITEM_SORT: FoodItemSortInput = { sort: 'bestBefore', order: 'asc' };

export const ConsumeFoodItemSchema = z
  .object({ amount: z.number().positive().max(MAX_QUANTITY) })
  .strict();
export type ConsumeFoodItemInput = z.infer<typeof ConsumeFoodItemSchema>;

export interface ConsumeResult {
  item: FoodItem;
  disposed: boolean;
  lowStock: boolean;
}

/** Rounds to 6 decimals to avoid float noise after subtraction (e.g. 0.3 - 0.1). */
export function roundQuantity(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Shared comparator for list sorting (in-memory repo); mirrors the SQLite
 * `ORDER BY <col> <dir>, id ASC` with NOCASE name collation.
 */
export function compareFoodItems(a: FoodItem, b: FoodItem, sort: FoodItemSortInput): number {
  let cmp = 0;
  switch (sort.sort) {
    case 'bestBefore':
      cmp = a.bestBefore.getTime() - b.bestBefore.getTime();
      break;
    case 'addedAt':
      cmp = a.addedAt.getTime() - b.addedAt.getTime();
      break;
    case 'quantity':
      cmp = a.quantity - b.quantity;
      break;
    case 'name': {
      const x = a.name.toLowerCase();
      const y = b.name.toLowerCase();
      cmp = x < y ? -1 : x > y ? 1 : 0;
      break;
    }
  }
  if (sort.order === 'desc') cmp = -cmp;
  if (cmp !== 0) return cmp;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Determines if a food item is expired relative to the given date.
 */
export function isExpired(item: FoodItem, now: Date = new Date()): boolean {
  return item.bestBefore < now;
}

/** End of the "expiring" window: `now` plus `days` of 24h (UTC arithmetic, DST-independent). */
export function expiryThreshold(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

/**
 * Determines if a food item is expiring within the given number of days.
 */
export function isExpiringSoon(
  item: FoodItem,
  withinDays: number,
  now: Date = new Date(),
): boolean {
  const threshold = expiryThreshold(now, withinDays);
  return item.bestBefore <= threshold && item.bestBefore >= now;
}

/**
 * Determines if a food item's quantity has fallen below its user-defined minimum.
 * Items without a `minimumQuantity` set are never considered low stock.
 */
export function isLowStock(item: FoodItem): boolean {
  return item.minimumQuantity !== undefined && item.quantity < item.minimumQuantity;
}
