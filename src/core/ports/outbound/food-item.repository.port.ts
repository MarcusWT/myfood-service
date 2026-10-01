import { FoodItem, UpdateFoodItemInput, FoodItemFilter, DisposalOutcome } from '../../domain/food-item.js';
import { Location } from '../../domain/value-objects.js';
import { PaginatedResult, PaginationInput } from '../../domain/pagination.js';

export interface FoodItemRepositoryPort {
  save(item: FoodItem): Promise<FoodItem>;
  findById(id: string, userId: string): Promise<FoodItem | null>;
  findAll(userId: string, filter?: FoodItemFilter): Promise<FoodItem[]>;
  findAllPaginated(
    userId: string,
    filter: FoodItemFilter,
    pagination: PaginationInput,
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
  delete(id: string, userId: string): Promise<boolean>;
}
