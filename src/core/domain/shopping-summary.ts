import { Category } from './value-objects.js';
import { FoodItem, isLowStock } from './food-item.js';

export interface ShoppingItem {
  name: string;
  category: Category;
  reason: 'EXPIRED' | 'LOW_STOCK' | 'EXPIRING_SOON';
  currentQuantity?: number;
  currentUnit?: string;
}

export interface ShoppingSummary {
  generatedAt: Date;
  totalItems: number;
  byCategory: Record<string, ShoppingItem[]>;
}

/**
 * Builds a shopping summary from a list of food items.
 * Includes items that are expired, expiring within 3 days, or below their
 * user-defined minimum quantity (low stock). When an item is both expiring
 * and low on stock, the expiry-related reason takes precedence.
 */
export function buildShoppingSummary(
  items: FoodItem[],
  now: Date = new Date(),
): ShoppingSummary {
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + 3);

  const shoppingItems: ShoppingItem[] = items
    .filter((item) => item.bestBefore <= threshold || isLowStock(item))
    .map((item) => {
      const reason: ShoppingItem['reason'] =
        item.bestBefore < now
          ? 'EXPIRED'
          : item.bestBefore <= threshold
            ? 'EXPIRING_SOON'
            : 'LOW_STOCK';

      return {
        name: item.name,
        category: item.category,
        reason,
        currentQuantity: item.quantity,
        currentUnit: item.unit,
      };
    });

  const byCategory: Record<string, ShoppingItem[]> = {};
  for (const shoppingItem of shoppingItems) {
    const key = shoppingItem.category;
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(shoppingItem);
  }

  return {
    generatedAt: now,
    totalItems: shoppingItems.length,
    byCategory,
  };
}
