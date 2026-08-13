import Database from 'better-sqlite3';
import { FoodItem, UpdateFoodItemInput, FoodItemFilter } from '../../../core/domain/food-item.js';
import { Location } from '../../../core/domain/value-objects.js';
import { PaginatedResult, PaginationInput } from '../../../core/domain/pagination.js';
import { FoodItemRepositoryPort } from '../../../core/ports/outbound/food-item.repository.port.js';

interface FoodItemRow {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
  category: string;
  best_before: string;
  added_at: string;
  updated_at: string;
  notes: string | null;
  minimum_quantity: number | null;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS food_items (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    quantity    REAL NOT NULL,
    unit        TEXT NOT NULL,
    location    TEXT NOT NULL,
    category    TEXT NOT NULL,
    best_before TEXT NOT NULL,
    added_at    TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    notes       TEXT,
    minimum_quantity REAL
  )
`;

function rowToFoodItem(row: FoodItemRow): FoodItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit as FoodItem['unit'],
    location: row.location as FoodItem['location'],
    category: row.category as FoodItem['category'],
    bestBefore: new Date(row.best_before),
    addedAt: new Date(row.added_at),
    updatedAt: new Date(row.updated_at),
    notes: row.notes ?? undefined,
    minimumQuantity: row.minimum_quantity ?? undefined,
  };
}

function buildWhereClause(filter?: FoodItemFilter): { where: string; params: Record<string, string> } {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (filter?.location) {
    conditions.push('location = @location');
    params.location = filter.location;
  }
  if (filter?.category) {
    conditions.push('category = @category');
    params.category = filter.category;
  }
  if (filter?.name) {
    conditions.push('name LIKE @name');
    params.name = `%${filter.name}%`;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

export class SqliteFoodItemRepository implements FoodItemRepositoryPort {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(CREATE_TABLE_SQL);
    this.migrateAddMinimumQuantityColumn();
  }

  private migrateAddMinimumQuantityColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(food_items)').all() as { name: string }[];
    if (!columns.some((column) => column.name === 'minimum_quantity')) {
      this.db.exec('ALTER TABLE food_items ADD COLUMN minimum_quantity REAL');
    }
  }

  async save(item: FoodItem): Promise<FoodItem> {
    this.db
      .prepare(
        `INSERT INTO food_items (id, name, quantity, unit, location, category, best_before, added_at, updated_at, notes, minimum_quantity)
         VALUES (@id, @name, @quantity, @unit, @location, @category, @best_before, @added_at, @updated_at, @notes, @minimum_quantity)`,
      )
      .run({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        category: item.category,
        best_before: item.bestBefore.toISOString(),
        added_at: item.addedAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
        notes: item.notes ?? null,
        minimum_quantity: item.minimumQuantity ?? null,
      });
    return item;
  }

  async findById(id: string): Promise<FoodItem | null> {
    const row = this.db
      .prepare('SELECT * FROM food_items WHERE id = ?')
      .get(id) as FoodItemRow | undefined;
    return row ? rowToFoodItem(row) : null;
  }

  async findAll(filter?: FoodItemFilter): Promise<FoodItem[]> {
    const { where, params } = buildWhereClause(filter);
    const rows = this.db
      .prepare(`SELECT * FROM food_items ${where} ORDER BY best_before ASC`)
      .all(params) as FoodItemRow[];

    return rows.map(rowToFoodItem);
  }

  async findAllPaginated(
    filter: FoodItemFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>> {
    const { where, params } = buildWhereClause(filter);

    const { count } = this.db
      .prepare(`SELECT COUNT(*) as count FROM food_items ${where}`)
      .get(params) as { count: number };

    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    const rows = this.db
      .prepare(`SELECT * FROM food_items ${where} ORDER BY best_before ASC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset }) as FoodItemRow[];

    return { data: rows.map(rowToFoodItem), total: count, page, limit };
  }

  async findByNameAndLocation(
    name: string,
    location: Location,
    excludeId?: string,
  ): Promise<FoodItem | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM food_items
         WHERE lower(name) = lower(@name) AND location = @location AND id != @excludeId`,
      )
      .get({ name, location, excludeId: excludeId ?? '' }) as FoodItemRow | undefined;
    return row ? rowToFoodItem(row) : null;
  }

  async update(id: string, input: UpdateFoodItemInput): Promise<FoodItem | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: FoodItem = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };

    this.db
      .prepare(
        `UPDATE food_items
         SET name = @name, quantity = @quantity, unit = @unit, location = @location,
             category = @category, best_before = @best_before, updated_at = @updated_at, notes = @notes,
             minimum_quantity = @minimum_quantity
         WHERE id = @id`,
      )
      .run({
        id: updated.id,
        name: updated.name,
        quantity: updated.quantity,
        unit: updated.unit,
        location: updated.location,
        category: updated.category,
        best_before: updated.bestBefore.toISOString(),
        updated_at: updated.updatedAt.toISOString(),
        notes: updated.notes ?? null,
        minimum_quantity: updated.minimumQuantity ?? null,
      });

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM food_items WHERE id = ?').run(id);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
