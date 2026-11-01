import {
  CreateShoppingListItemInput,
  ShoppingListItem,
  UpdateShoppingListItemInput,
} from '../../domain/shopping-list.js';

export interface ShoppingListServicePort {
  list(userId: string): Promise<ShoppingListItem[]>;
  add(userId: string, input: CreateShoppingListItemInput): Promise<ShoppingListItem>;
  update(userId: string, id: string, patch: UpdateShoppingListItemInput): Promise<ShoppingListItem>;
  remove(userId: string, id: string): Promise<void>;
  clearChecked(userId: string): Promise<{ removed: number }>;
  importFromSummary(userId: string): Promise<ShoppingListItem[]>;
}
