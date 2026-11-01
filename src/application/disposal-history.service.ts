import { DisposalHistoryServicePort } from '../core/ports/inbound/disposal-history.service.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';
import { FoodItem } from '../core/domain/food-item.js';
import { HistoryFilter, WasteStats, WasteStatsRange } from '../core/domain/disposal-history.js';
import { PaginatedResult, PaginationInput } from '../core/domain/pagination.js';
import { ZodError } from 'zod';

const DEFAULT_RANGE_DAYS = 90;

export class DisposalHistoryService implements DisposalHistoryServicePort {
  constructor(
    private readonly repository: FoodItemRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listHistory(
    userId: string,
    filter: HistoryFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>> {
    return this.repository.findDisposedPaginated(userId, filter, pagination);
  }

  async getWasteStats(userId: string, range: Partial<WasteStatsRange>): Promise<WasteStats> {
    const to = range.to ?? this.now();
    const from = range.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * 86_400_000);
    if (from.getTime() > to.getTime()) {
      throw new ZodError([
        { code: 'custom', path: ['from'], message: 'from must be before or equal to to' },
      ]);
    }

    const rows = await this.repository.getDisposalStats(userId, { from, to });
    const byCategory = new Map<string, { consumed: number; discarded: number }>();
    const byMonth = new Map<string, { consumed: number; discarded: number }>();
    let consumed = 0;
    let discarded = 0;
    for (const row of rows) {
      consumed += row.consumed;
      discarded += row.discarded;
      const c = byCategory.get(row.category) ?? { consumed: 0, discarded: 0 };
      c.consumed += row.consumed;
      c.discarded += row.discarded;
      byCategory.set(row.category, c);
      const m = byMonth.get(row.month) ?? { consumed: 0, discarded: 0 };
      m.consumed += row.consumed;
      m.discarded += row.discarded;
      byMonth.set(row.month, m);
    }
    const total = consumed + discarded;
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: { consumed, discarded, total, wasteRate: total === 0 ? 0 : Math.round((discarded / total) * 1e4) / 1e4 },
      byCategory: [...byCategory.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([category, v]) => ({ category, ...v })),
      byMonth: [...byMonth.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([month, v]) => ({ month, ...v })),
    };
  }
}
