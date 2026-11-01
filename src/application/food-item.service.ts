import { ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { FoodItem, CreateFoodItemInput, UpdateFoodItemInput, FoodItemFilter, DisposalOutcome, FoodItemSortInput, ConsumeResult, isLowStock } from '../core/domain/food-item.js';
import { PaginatedResult, PaginationInput } from '../core/domain/pagination.js';
import { FoodItemServicePort } from '../core/ports/inbound/food-item.service.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';

import { NotFoundError, ConflictError } from '../core/domain/errors.js';

export { NotFoundError, ConflictError };

export class FoodItemService implements FoodItemServicePort {
  constructor(
    private readonly repository: FoodItemRepositoryPort,
    private readonly expiringWithinDays: number = 7,
  ) {}

  async addItem(userId: string, input: CreateFoodItemInput): Promise<FoodItem> {
    const existing = await this.repository.findByNameAndLocation(
      userId,
      input.name,
      input.location,
    );
    if (existing) {
      throw new ConflictError(
        `An item named '${input.name}' already exists in ${input.location}`,
      );
    }

    const now = new Date();
    const item: FoodItem = {
      ...input,
      id: uuidv4(),
      userId,
      addedAt: now,
      updatedAt: now,
    };
    return this.repository.save(item);
  }

  async getItem(id: string, userId: string): Promise<FoodItem> {
    const item = await this.repository.findById(id, userId);
    if (!item) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }
    return item;
  }

  async listItems(userId: string, filter?: FoodItemFilter): Promise<FoodItem[]> {
    return this.repository.findAll(userId, filter);
  }

  async listItemsPaginated(
    userId: string,
    filter: FoodItemFilter,
    pagination: PaginationInput,
    sort?: FoodItemSortInput,
  ): Promise<PaginatedResult<FoodItem>> {
    const effective =
      filter.status && filter.expiringWithinDays === undefined
        ? { ...filter, expiringWithinDays: this.expiringWithinDays }
        : filter;
    return this.repository.findAllPaginated(userId, effective, pagination, sort);
  }

  async updateItem(id: string, userId: string, input: UpdateFoodItemInput): Promise<FoodItem> {
    const existing = await this.repository.findById(id, userId);
    if (!existing) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }

    if (input.bestBefore !== undefined && input.bestBefore.getTime() !== existing.bestBefore.getTime() && input.bestBefore.getTime() <= Date.now()) {
      throw new ZodError([
        { code: 'custom', path: ['bestBefore'], message: 'bestBefore must be a future date' },
      ]);
    }

    if (input.name !== undefined || input.location !== undefined) {
      const effectiveName = input.name ?? existing.name;
      const effectiveLocation = input.location ?? existing.location;
      const conflict = await this.repository.findByNameAndLocation(
        userId,
        effectiveName,
        effectiveLocation,
        id,
      );
      if (conflict) {
        throw new ConflictError(
          `An item named '${effectiveName}' already exists in ${effectiveLocation}`,
        );
      }
    }

    const updated = await this.repository.update(id, userId, input);
    if (!updated) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }
    return updated;
  }

  async disposeItem(id: string, userId: string, outcome: DisposalOutcome): Promise<FoodItem> {
    const disposed = await this.repository.dispose(id, userId, outcome);
    if (!disposed) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }
    return disposed;
  }

  async consumeItem(id: string, userId: string, amount: number): Promise<ConsumeResult> {
    const item = await this.repository.consume(id, userId, amount);
    if (!item) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }
    const disposed = item.disposition !== undefined;
    return { item, disposed, lowStock: disposed ? false : isLowStock(item) };
  }

  async restoreItem(id: string, userId: string): Promise<FoodItem> {
    const disposed = await this.repository.findDisposedById(id, userId);
    if (!disposed) {
      throw new NotFoundError(`Disposed food item with id '${id}' not found`);
    }
    const duplicate = await this.repository.findByNameAndLocation(userId, disposed.name, disposed.location);
    if (duplicate) {
      throw new ConflictError(
        `Cannot restore: an active item named '${disposed.name}' already exists in ${disposed.location}`,
      );
    }
    const restored = await this.repository.restore(id, userId);
    if (!restored) {
      throw new NotFoundError(`Disposed food item with id '${id}' not found`);
    }
    return restored;
  }

  async removeItem(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }
  }
}
