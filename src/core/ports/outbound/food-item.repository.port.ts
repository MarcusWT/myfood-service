import { FoodItem, UpdateFoodItemInput, FoodItemFilter } from '../../domain/food-item.js';
import { PaginatedResult, PaginationInput } from '../../domain/pagination.js';

export interface FoodItemRepositoryPort {
  save(item: FoodItem): Promise<FoodItem>;
  findById(id: string): Promise<FoodItem | null>;
  findAll(filter?: FoodItemFilter): Promise<FoodItem[]>;
  findAllPaginated(
    filter: FoodItemFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>>;
  update(id: string, input: UpdateFoodItemInput): Promise<FoodItem | null>;
  delete(id: string): Promise<boolean>;
}
