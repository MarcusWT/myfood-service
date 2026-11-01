import {
  FoodItem,
  UpdateFoodItemInput,
  applyUpdate,
  FoodItemFilter,
  DisposalOutcome,
  FoodItemSortInput,
  DEFAULT_FOOD_ITEM_SORT,
  compareFoodItems,
  roundQuantity,
  expiryThreshold,
} from '../../../core/domain/food-item.js';
import { Location } from '../../../core/domain/value-objects.js';
import { PaginatedResult, PaginationInput, paginate } from '../../../core/domain/pagination.js';
import { HistoryFilter, DisposalStatsRow, WasteStatsRange } from '../../../core/domain/disposal-history.js';
import { ConflictError } from '../../../core/domain/errors.js';
import { FoodItemRepositoryPort } from '../../../core/ports/outbound/food-item.repository.port.js';

function clone(item: FoodItem): FoodItem {
  return { ...item };
}

function applyFilter(items: FoodItem[], filter?: FoodItemFilter): FoodItem[] {
  let results = items;

  if (filter?.location) {
    results = results.filter((item) => item.location === filter.location);
  }
  if (filter?.category) {
    results = results.filter((item) => item.category === filter.category);
  }
  if (filter?.name) {
    const needle = filter.name.toLowerCase();
    results = results.filter((item) => item.name.toLowerCase().includes(needle));
  }
  if (filter?.lowStock !== undefined) {
    const want = filter.lowStock;
    results = results.filter(
      (item) => (item.minimumQuantity !== undefined && item.quantity < item.minimumQuantity) === want,
    );
  }
  if (filter?.expiringBefore) {
    const iso = filter.expiringBefore.toISOString();
    results = results.filter((item) => item.bestBefore.toISOString() <= iso);
  }
  if (filter?.status) {
    const now = filter.now ?? new Date();
    const nowIso = now.toISOString();
    const limitIso = expiryThreshold(now, filter.expiringWithinDays ?? 7).toISOString();
    results = results.filter((item) => {
      const bb = item.bestBefore.toISOString();
      if (filter.status === 'expired') return bb < nowIso;
      if (filter.status === 'expiring') return bb >= nowIso && bb <= limitIso;
      return bb > limitIso;
    });
  }

  return results;
}

/**
 * In-memory implementation of FoodItemRepositoryPort, intended for fast,
 * isolated tests and as a DB_PATH=:memory: fallback for local development.
 */
export class InMemoryFoodItemRepository implements FoodItemRepositoryPort {
  private readonly items = new Map<string, FoodItem>();

  async save(item: FoodItem): Promise<FoodItem> {
    this.items.set(item.id, clone(item));
    return clone(item);
  }

  async findById(id: string, userId: string): Promise<FoodItem | null> {
    const item = this.items.get(id);
    return item && item.userId === userId && !item.disposition ? clone(item) : null;
  }

  async findAll(
    userId: string,
    filter?: FoodItemFilter,
    sort: FoodItemSortInput = DEFAULT_FOOD_ITEM_SORT,
  ): Promise<FoodItem[]> {
    const owned = Array.from(this.items.values()).filter((item) => item.userId === userId && !item.disposition);
    const results = applyFilter(owned, filter);
    results.sort((a, b) => compareFoodItems(a, b, sort));
    return results.map(clone);
  }

  async findAllPaginated(
    userId: string,
    filter: FoodItemFilter,
    pagination: PaginationInput,
    sort: FoodItemSortInput = DEFAULT_FOOD_ITEM_SORT,
  ): Promise<PaginatedResult<FoodItem>> {
    const owned = Array.from(this.items.values()).filter((item) => item.userId === userId && !item.disposition);
    const results = applyFilter(owned, filter);
    results.sort((a, b) => compareFoodItems(a, b, sort));

    const total = results.length;
    const { page, limit } = pagination;
    const start = (page - 1) * limit;
    const data = results.slice(start, start + limit).map(clone);

    return paginate(data, total, pagination);
  }

  async findByNameAndLocation(
    userId: string,
    name: string,
    location: Location,
    excludeId?: string,
  ): Promise<FoodItem | null> {
    const needle = name.toLowerCase();
    const match = Array.from(this.items.values()).find(
      (item) =>
        item.userId === userId &&
        !item.disposition &&
        item.name.toLowerCase() === needle &&
        item.location === location &&
        item.id !== excludeId,
    );
    return match ? clone(match) : null;
  }

  async update(id: string, userId: string, input: UpdateFoodItemInput): Promise<FoodItem | null> {
    const existing = this.items.get(id);
    if (!existing || existing.userId !== userId || existing.disposition) return null;

    const updated = applyUpdate(existing, input, new Date());

    this.items.set(id, updated);
    return clone(updated);
  }

  async dispose(id: string, userId: string, outcome: DisposalOutcome): Promise<FoodItem | null> {
    const existing = this.items.get(id);
    if (!existing || existing.userId !== userId || existing.disposition) return null;
    const now = new Date();
    const disposed: FoodItem = { ...existing, disposition: outcome, disposedAt: now, updatedAt: now };
    this.items.set(id, disposed);
    return clone(disposed);
  }

  async consume(id: string, userId: string, amount: number): Promise<FoodItem | null> {
    const existing = this.items.get(id);
    if (!existing || existing.userId !== userId || existing.disposition) return null;
    const now = new Date();
    const remainder = roundQuantity(existing.quantity - amount);
    const updated: FoodItem =
      remainder > 0
        ? { ...existing, quantity: remainder, updatedAt: now }
        : { ...existing, disposition: 'CONSUMED', disposedAt: now, updatedAt: now };
    this.items.set(id, updated);
    return clone(updated);
  }

  private disposedFor(userId: string): FoodItem[] {
    return Array.from(this.items.values()).filter(
      (item) => item.userId === userId && item.disposition && item.disposedAt,
    );
  }

  async findDisposedPaginated(
    userId: string,
    filter: HistoryFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>> {
    let results = this.disposedFor(userId);
    if (filter.outcome) results = results.filter((i) => i.disposition === filter.outcome);
    if (filter.from) {
      const from = filter.from.toISOString();
      results = results.filter((i) => i.disposedAt!.toISOString() >= from);
    }
    if (filter.to) {
      const to = filter.to.toISOString();
      results = results.filter((i) => i.disposedAt!.toISOString() <= to);
    }
    results.sort((a, b) => {
      const d = b.disposedAt!.getTime() - a.disposedAt!.getTime();
      if (d !== 0) return d;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const { page, limit } = pagination;
    const start = (page - 1) * limit;
    return paginate(results.slice(start, start + limit).map(clone), results.length, pagination);
  }

  async findDisposedById(id: string, userId: string): Promise<FoodItem | null> {
    const item = this.items.get(id);
    return item && item.userId === userId && item.disposition ? clone(item) : null;
  }

  async restore(id: string, userId: string): Promise<FoodItem | null> {
    const existing = this.items.get(id);
    if (!existing || existing.userId !== userId || !existing.disposition) return null;
    const needle = existing.name.toLowerCase();
    const clash = Array.from(this.items.values()).some(
      (i) =>
        i.id !== id &&
        i.userId === userId &&
        !i.disposition &&
        i.location === existing.location &&
        i.name.toLowerCase() === needle,
    );
    if (clash) {
      throw new ConflictError(
        `Cannot restore: an active item named '${existing.name}' already exists in ${existing.location}`,
      );
    }
    const { disposition: _d, disposedAt: _a, ...rest } = existing;
    void _d;
    void _a;
    const restored: FoodItem = { ...rest, updatedAt: new Date() };
    this.items.set(id, restored);
    return clone(restored);
  }

  async getDisposalStats(userId: string, range: WasteStatsRange): Promise<DisposalStatsRow[]> {
    const from = range.from.toISOString();
    const to = range.to.toISOString();
    const groups = new Map<string, DisposalStatsRow>();
    for (const item of this.disposedFor(userId)) {
      const at = item.disposedAt!.toISOString();
      if (at < from || at > to) continue;
      const month = at.slice(0, 7);
      const key = `${item.category}|${month}`;
      const row = groups.get(key) ?? { category: item.category, month, consumed: 0, discarded: 0 };
      if (item.disposition === 'CONSUMED') row.consumed += 1;
      else row.discarded += 1;
      groups.set(key, row);
    }
    return Array.from(groups.values());
  }

  async purgeDisposedBefore(cutoff: Date): Promise<number> {
    let count = 0;
    for (const [id, item] of this.items) {
      if (item.disposition && item.disposedAt && item.disposedAt.getTime() < cutoff.getTime()) {
        this.items.delete(id);
        count++;
      }
    }
    return count;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = this.items.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.items.delete(id);
  }

  /**
   * Test-only helper to reset repository state between tests without
   * constructing a new instance.
   */
  clear(): void {
    this.items.clear();
  }
}
