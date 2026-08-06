import { FoodItem, UpdateFoodItemInput, FoodItemFilter } from '../../../core/domain/food-item.js';
import { Location } from '../../../core/domain/value-objects.js';
import { PaginatedResult, PaginationInput } from '../../../core/domain/pagination.js';
import { FoodItemRepositoryPort } from '../../../core/ports/outbound/food-item.repository.port.js';

function clone(item: FoodItem): FoodItem {
  return { ...item };
}

function applyFilter(items: FoodItem[], filter?: FoodItemFilter): FoodItem[] {
  let results = items;

  if (filter?.location) {
    results = results.filter((item) => item.location === filter.location);
  }
  if (filter?.category) {
    results = results.filter((item) => item.category === filter.category);
  }
  if (filter?.name) {
    const needle = filter.name.toLowerCase();
    results = results.filter((item) => item.name.toLowerCase().includes(needle));
  }

  return results;
}

/**
 * In-memory implementation of FoodItemRepositoryPort, intended for fast,
 * isolated tests and as a DB_PATH=:memory: fallback for local development.
 */
export class InMemoryFoodItemRepository implements FoodItemRepositoryPort {
  private readonly items = new Map<string, FoodItem>();

  async save(item: FoodItem): Promise<FoodItem> {
    this.items.set(item.id, clone(item));
    return clone(item);
  }

  async findById(id: string): Promise<FoodItem | null> {
    const item = this.items.get(id);
    return item ? clone(item) : null;
  }

  async findAll(filter?: FoodItemFilter): Promise<FoodItem[]> {
    const results = applyFilter(Array.from(this.items.values()), filter);
    results.sort((a, b) => a.bestBefore.getTime() - b.bestBefore.getTime());
    return results.map(clone);
  }

  async findAllPaginated(
    filter: FoodItemFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>> {
    const results = applyFilter(Array.from(this.items.values()), filter);
    results.sort((a, b) => a.bestBefore.getTime() - b.bestBefore.getTime());

    const total = results.length;
    const { page, limit } = pagination;
    const start = (page - 1) * limit;
    const data = results.slice(start, start + limit).map(clone);

    return { data, total, page, limit };
  }

  async findByNameAndLocation(
    name: string,
    location: Location,
    excludeId?: string,
  ): Promise<FoodItem | null> {
    const needle = name.toLowerCase();
    const match = Array.from(this.items.values()).find(
      (item) =>
        item.name.toLowerCase() === needle &&
        item.location === location &&
        item.id !== excludeId,
    );
    return match ? clone(match) : null;
  }

  async update(id: string, input: UpdateFoodItemInput): Promise<FoodItem | null> {
    const existing = this.items.get(id);
    if (!existing) return null;

    const updated: FoodItem = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };

    this.items.set(id, updated);
    return clone(updated);
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  /**
   * Test-only helper to reset repository state between tests without
   * constructing a new instance.
   */
  clear(): void {
    this.items.clear();
  }
}
