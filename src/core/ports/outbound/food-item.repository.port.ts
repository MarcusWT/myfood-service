import { FoodItem, UpdateFoodItemInput, FoodItemFilter } from '../../domain/food-item.js';
import { Location } from '../../domain/value-objects.js';
import { PaginatedResult, PaginationInput } from '../../domain/pagination.js';

export interface FoodItemRepositoryPort {
  save(item: FoodItem): Promise<FoodItem>;
  findById(id: string): Promise<FoodItem | null>;
  findAll(filter?: FoodItemFilter): Promise<FoodItem[]>;
  findAllPaginated(
    filter: FoodItemFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>>;
  /**
   * Finds an item with a case-insensitive matching name in the given
   * location, optionally excluding a specific item id (used when checking
   * for conflicts during an update). Used to enforce no-duplicate-names
   * per location.
   */
  findByNameAndLocation(
    name: string,
    location: Location,
    excludeId?: string,
  ): Promise<FoodItem | null>;
  update(id: string, input: UpdateFoodItemInput): Promise<FoodItem | null>;
  delete(id: string): Promise<boolean>;
}
