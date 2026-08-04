import { FoodItem, CreateFoodItemInput, UpdateFoodItemInput, FoodItemFilter } from '../../domain/food-item.js';

export interface FoodItemServicePort {
  addItem(input: CreateFoodItemInput): Promise<FoodItem>;
  getItem(id: string): Promise<FoodItem>;
  listItems(filter?: FoodItemFilter): Promise<FoodItem[]>;
  updateItem(id: string, input: UpdateFoodItemInput): Promise<FoodItem>;
  removeItem(id: string): Promise<void>;
}
