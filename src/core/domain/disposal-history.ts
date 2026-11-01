import { z } from 'zod';
import { CategorySchema } from './value-objects.js';
import { DisposalOutcomeSchema, dateBoundSchema } from './food-item.js';

export const HistoryFilterSchema = z
  .object({
    outcome: DisposalOutcomeSchema.optional(),
    from: dateBoundSchema(false).optional(),
    to: dateBoundSchema(true).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from.getTime() <= v.to.getTime(), {
    message: 'from must be before or equal to to',
    path: ['from'],
  });
export type HistoryFilter = z.infer<typeof HistoryFilterSchema>;

export const WasteStatsQuerySchema = z
  .object({
    from: dateBoundSchema(false).optional(),
    to: dateBoundSchema(true).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from.getTime() <= v.to.getTime(), {
    message: 'from must be before or equal to to',
    path: ['from'],
  });
export type WasteStatsQuery = z.infer<typeof WasteStatsQuerySchema>;

export interface WasteStatsRange {
  from: Date;
  to: Date;
}

/** One grouped row as returned by the repository. */
export interface DisposalStatsRow {
  category: z.infer<typeof CategorySchema>;
  month: string;
  consumed: number;
  discarded: number;
}

export interface WasteStats {
  from: string;
  to: string;
  totals: { consumed: number; discarded: number; total: number; wasteRate: number };
  byCategory: Array<{ category: string; consumed: number; discarded: number }>;
  byMonth: Array<{ month: string; consumed: number; discarded: number }>;
}
