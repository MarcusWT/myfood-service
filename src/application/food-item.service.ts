import { v4 as uuidv4 } from 'uuid';
import { FoodItem, CreateFoodItemInput, UpdateFoodItemInput, FoodItemFilter, DisposalOutcome } from '../core/domain/food-item.js';
import { PaginatedResult, PaginationInput } from '../core/domain/pagination.js';
import { FoodItemServicePort } from '../core/ports/inbound/food-item.service.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class FoodItemService implements FoodItemServicePort {
  constructor(private readonly repository: FoodItemRepositoryPort) {}

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
  ): Promise<PaginatedResult<FoodItem>> {
    return this.repository.findAllPaginated(userId, filter, pagination);
  }

  async updateItem(id: string, userId: string, input: UpdateFoodItemInput): Promise<FoodItem> {
    const existing = await this.repository.findById(id, userId);
    if (!existing) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
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

  async removeItem(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }
  }
}
