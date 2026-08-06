import { FoodItem, CreateFoodItemInput, UpdateFoodItemInput, FoodItemFilter } from '../../domain/food-item.js';
import { PaginatedResult, PaginationInput } from '../../domain/pagination.js';

export interface FoodItemServicePort {
  addItem(input: CreateFoodItemInput): Promise<FoodItem>;
  getItem(id: string): Promise<FoodItem>;
  listItems(filter?: FoodItemFilter): Promise<FoodItem[]>;
  listItemsPaginated(
    filter: FoodItemFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>>;
  updateItem(id: string, input: UpdateFoodItemInput): Promise<FoodItem>;
  removeItem(id: string): Promise<void>;
}
