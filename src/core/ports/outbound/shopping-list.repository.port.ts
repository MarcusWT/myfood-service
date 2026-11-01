import {
  ShoppingListItem,
  UpdateShoppingListItemInput,
} from '../../domain/shopping-list.js';

export interface ShoppingListRepositoryPort {
  findAll(userId: string): Promise<ShoppingListItem[]>;
  findById(userId: string, id: string): Promise<ShoppingListItem | null>;
  create(item: ShoppingListItem): Promise<ShoppingListItem>;
  update(
    userId: string,
    id: string,
    patch: UpdateShoppingListItemInput,
  ): Promise<ShoppingListItem | null>;
  delete(userId: string, id: string): Promise<boolean>;
  deleteChecked(userId: string): Promise<number>;
  /** Atomically inserts unless the user already has `max` items; null when at the cap. */
  createIfUnderLimit(item: ShoppingListItem, max: number): Promise<ShoppingListItem | null>;
  /** All-or-nothing: inserts every item, or none (returns null) if that would exceed `max`. */
  createManyIfUnderLimit(items: ShoppingListItem[], max: number): Promise<ShoppingListItem[] | null>;
  countByUser(userId: string): Promise<number>;
}
