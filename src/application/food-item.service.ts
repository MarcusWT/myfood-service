import { v4 as uuidv4 } from 'uuid';
import { FoodItem, CreateFoodItemInput, UpdateFoodItemInput, FoodItemFilter } from '../core/domain/food-item.js';
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

  async addItem(input: CreateFoodItemInput): Promise<FoodItem> {
    const existing = await this.repository.findByNameAndLocation(input.name, input.location);
    if (existing) {
      throw new ConflictError(
        `An item named '${input.name}' already exists in ${input.location}`,
      );
    }

    const now = new Date();
    const item: FoodItem = {
      ...input,
      id: uuidv4(),
      addedAt: now,
      updatedAt: now,
    };
    return this.repository.save(item);
  }

  async getItem(id: string): Promise<FoodItem> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }
    return item;
  }

  async listItems(filter?: FoodItemFilter): Promise<FoodItem[]> {
    return this.repository.findAll(filter);
  }

  async listItemsPaginated(
    filter: FoodItemFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>> {
    return this.repository.findAllPaginated(filter, pagination);
  }

  async updateItem(id: string, input: UpdateFoodItemInput): Promise<FoodItem> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }

    if (input.name !== undefined || input.location !== undefined) {
      const effectiveName = input.name ?? existing.name;
      const effectiveLocation = input.location ?? existing.location;
      const conflict = await this.repository.findByNameAndLocation(
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

    const updated = await this.repository.update(id, input);
    if (!updated) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }
    return updated;
  }

  async removeItem(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundError(`Food item with id '${id}' not found`);
    }
  }
}
