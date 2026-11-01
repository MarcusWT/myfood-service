import { FoodItem } from '../../domain/food-item.js';
import { HistoryFilter, WasteStats, WasteStatsRange } from '../../domain/disposal-history.js';
import { PaginatedResult, PaginationInput } from '../../domain/pagination.js';

export interface DisposalHistoryServicePort {
  listHistory(
    userId: string,
    filter: HistoryFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>>;
  getWasteStats(userId: string, range: Partial<WasteStatsRange>): Promise<WasteStats>;
}
