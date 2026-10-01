import { FoodItem, CreateFoodItemInput, UpdateFoodItemInput, FoodItemFilter, DisposalOutcome } from '../../domain/food-item.js';
import { PaginatedResult, PaginationInput } from '../../domain/pagination.js';

export interface FoodItemServicePort {
  addItem(userId: string, input: CreateFoodItemInput): Promise<FoodItem>;
  getItem(id: string, userId: string): Promise<FoodItem>;
  listItems(userId: string, filter?: FoodItemFilter): Promise<FoodItem[]>;
  listItemsPaginated(
    userId: string,
    filter: FoodItemFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>>;
  updateItem(id: string, userId: string, input: UpdateFoodItemInput): Promise<FoodItem>;
  disposeItem(id: string, userId: string, outcome: DisposalOutcome): Promise<FoodItem>;
  removeItem(id: string, userId: string): Promise<void>;
}
