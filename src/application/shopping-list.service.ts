import { randomUUID } from 'node:crypto';
import {
  CreateShoppingListItemInput,
  MAX_SHOPPING_LIST_ITEMS,
  ShoppingListItem,
  UpdateShoppingListItemInput,
} from '../core/domain/shopping-list.js';
import { buildShoppingSummary } from '../core/domain/shopping-summary.js';
import { LimitExceededError, NotFoundError } from '../core/domain/errors.js';
import { ShoppingListServicePort } from '../core/ports/inbound/shopping-list.service.port.js';
import { ShoppingListRepositoryPort } from '../core/ports/outbound/shopping-list.repository.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';
import type { Unit } from '../core/domain/value-objects.js';

const UNITS: readonly string[] = [
  'GRAMS', 'KILOGRAMS', 'MILLILITRES', 'LITRES', 'UNITS', 'SLICES', 'PORTIONS',
];

export class ShoppingListService implements ShoppingListServicePort {
  constructor(
    private readonly listRepo: ShoppingListRepositoryPort,
    private readonly foodRepo: FoodItemRepositoryPort,
  ) {}

  list(userId: string): Promise<ShoppingListItem[]> {
    return this.listRepo.findAll(userId);
  }

  async add(userId: string, input: CreateShoppingListItemInput): Promise<ShoppingListItem> {
    const created = await this.listRepo.createIfUnderLimit(
      this.build(userId, input),
      MAX_SHOPPING_LIST_ITEMS,
    );
    if (!created) throw this.limitError();
    return created;
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateShoppingListItemInput,
  ): Promise<ShoppingListItem> {
    const updated = await this.listRepo.update(userId, id, patch);
    if (!updated) throw new NotFoundError(`Shopping list item with id '${id}' not found`);
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.listRepo.delete(userId, id))) {
      throw new NotFoundError(`Shopping list item with id '${id}' not found`);
    }
  }

  async clearChecked(userId: string): Promise<{ removed: number }> {
    return { removed: await this.listRepo.deleteChecked(userId) };
  }

  async importFromSummary(userId: string): Promise<ShoppingListItem[]> {
    const summary = buildShoppingSummary(await this.foodRepo.findAll(userId));
    const existing = new Set(
      (await this.listRepo.findAll(userId)).map((i) => i.name.trim().toLowerCase()),
    );
    const candidates: ShoppingListItem[] = [];
    for (const entry of Object.values(summary.byCategory).flat()) {
      const key = entry.name.trim().toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      const unit =
        entry.currentUnit && UNITS.includes(entry.currentUnit)
          ? (entry.currentUnit as Unit)
          : undefined;
      candidates.push(this.build(userId, { name: entry.name, category: entry.category, unit }));
    }
    // All-or-nothing: either every candidate is created or none (LimitExceededError).
    const created = await this.listRepo.createManyIfUnderLimit(candidates, MAX_SHOPPING_LIST_ITEMS);
    if (!created) throw this.limitError();
    return created;
  }

  private limitError(): LimitExceededError {
    return new LimitExceededError(`Shopping list is limited to ${MAX_SHOPPING_LIST_ITEMS} items`);
  }

  private build(userId: string, input: CreateShoppingListItemInput): ShoppingListItem {
    const now = new Date();
    return {
      id: randomUUID(),
      userId,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      category: input.category ?? 'OTHER',
      checked: false,
      createdAt: now,
      updatedAt: now,
    };
  }
}
