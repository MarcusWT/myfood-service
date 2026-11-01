import { FoodItem, UpdateFoodItemInput, FoodItemFilter, DisposalOutcome, FoodItemSortInput } from '../../domain/food-item.js';
import { HistoryFilter, DisposalStatsRow, WasteStatsRange } from '../../domain/disposal-history.js';
import { Location } from '../../domain/value-objects.js';
import { PaginatedResult, PaginationInput } from '../../domain/pagination.js';

export interface FoodItemRepositoryPort {
  save(item: FoodItem): Promise<FoodItem>;
  findById(id: string, userId: string): Promise<FoodItem | null>;
  findAll(userId: string, filter?: FoodItemFilter, sort?: FoodItemSortInput): Promise<FoodItem[]>;
  findAllPaginated(
    userId: string,
    filter: FoodItemFilter,
    pagination: PaginationInput,
    sort?: FoodItemSortInput,
  ): Promise<PaginatedResult<FoodItem>>;
  /**
   * Finds an item with a case-insensitive matching name in the given
   * location, optionally excluding a specific item id (used when checking
   * for conflicts during an update). Used to enforce no-duplicate-names
   * per location. Scoped to the given user.
   */
  findByNameAndLocation(
    userId: string,
    name: string,
    location: Location,
    excludeId?: string,
  ): Promise<FoodItem | null>;
  update(id: string, userId: string, input: UpdateFoodItemInput): Promise<FoodItem | null>;
  /**
   * Marks an active item as disposed (consumed/discarded) rather than
   * deleting it. Returns null if the item doesn't exist, belongs to another
   * user, or is already disposed. Disposed items are excluded from every
   * other read method except via hard `delete`.
   */
  dispose(id: string, userId: string, outcome: DisposalOutcome): Promise<FoodItem | null>;
  /**
   * Atomically decrements quantity of an active item. If `amount` >= current
   * quantity the item is disposed as CONSUMED (quantity left unchanged).
   * Returns null if not found / not owned / already disposed.
   */
  consume(id: string, userId: string, amount: number): Promise<FoodItem | null>;
  /** Disposed items, newest `disposedAt` first. */
  findDisposedPaginated(
    userId: string,
    filter: HistoryFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>>;
  findDisposedById(id: string, userId: string): Promise<FoodItem | null>;
  /** Makes a disposed item active again; null if not disposed/not owned. May throw ConflictError. */
  restore(id: string, userId: string): Promise<FoodItem | null>;
  /** Grouped disposal counts (by category and UTC month) with disposed_at in [from, to]. */
  getDisposalStats(userId: string, range: WasteStatsRange): Promise<DisposalStatsRow[]>;
  /** Hard-deletes disposed rows (all users) with disposedAt < cutoff. Returns count. */
  purgeDisposedBefore(cutoff: Date): Promise<number>;
  delete(id: string, userId: string): Promise<boolean>;
}
