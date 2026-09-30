import Database from 'better-sqlite3';
import { FoodItem, UpdateFoodItemInput, FoodItemFilter } from '../../../core/domain/food-item.js';
import { Location } from '../../../core/domain/value-objects.js';
import { PaginatedResult, PaginationInput } from '../../../core/domain/pagination.js';
import { FoodItemRepositoryPort } from '../../../core/ports/outbound/food-item.repository.port.js';

interface FoodItemRow {
  id: string;
  user_id: string | null;
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
    userId: row.user_id ?? '',
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

function buildWhereClause(
  userId: string,
  filter?: FoodItemFilter,
): { where: string; params: Record<string, string> } {
  const conditions: string[] = ['user_id = @userId'];
  const params: Record<string, string> = { userId };

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

  const where = `WHERE ${conditions.join(' AND ')}`;
  return { where, params };
}

export class SqliteFoodItemRepository implements FoodItemRepositoryPort {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(CREATE_TABLE_SQL);
    this.migrateAddMinimumQuantityColumn();
    this.migrateAddUserIdColumn();
  }

  /**
   * Exposes the underlying `better-sqlite3` connection for cross-cutting
   * concerns that need direct DB access (e.g. a readiness health check).
   * Kept read-only in intent — callers should not run mutating statements
   * through this escape hatch.
   */
  getConnection(): Database.Database {
    return this.db;
  }

  private migrateAddMinimumQuantityColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(food_items)').all() as { name: string }[];
    if (!columns.some((column) => column.name === 'minimum_quantity')) {
      this.db.exec('ALTER TABLE food_items ADD COLUMN minimum_quantity REAL');
    }
  }

  private migrateAddUserIdColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(food_items)').all() as { name: string }[];
    if (!columns.some((column) => column.name === 'user_id')) {
      this.db.exec('ALTER TABLE food_items ADD COLUMN user_id TEXT');
    }
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_food_items_user_id ON food_items(user_id)');

    const { count } = this.db
      .prepare('SELECT COUNT(*) as count FROM food_items WHERE user_id IS NULL')
      .get() as { count: number };
    if (count > 0) {
      // Every read/write/delete query in this repository is scoped with
      // `WHERE user_id = ?`, and `NULL = ?` is never true in SQL — so rows
      // left over from before authentication was introduced would otherwise
      // become permanently invisible (not 404, just silently absent from
      // every list/get) with no way to reach them through the API. Failing
      // fast here forces an explicit decision rather than a silent data loss.
      throw new Error(
        `[Migration] food_items table has ${count} row(s) with no user_id, left over from ` +
          'before authentication was added. These rows would become permanently inaccessible ' +
          'through the API. Assign them to a user manually (e.g. ' +
          "`UPDATE food_items SET user_id = '<uuid>' WHERE user_id IS NULL`) before starting the server.",
      );
    }
  }

  async save(item: FoodItem): Promise<FoodItem> {
    this.db
      .prepare(
        `INSERT INTO food_items (id, user_id, name, quantity, unit, location, category, best_before, added_at, updated_at, notes, minimum_quantity)
         VALUES (@id, @user_id, @name, @quantity, @unit, @location, @category, @best_before, @added_at, @updated_at, @notes, @minimum_quantity)`,
      )
      .run({
        id: item.id,
        user_id: item.userId,
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

  async findById(id: string, userId: string): Promise<FoodItem | null> {
    const row = this.db
      .prepare('SELECT * FROM food_items WHERE id = ? AND user_id = ?')
      .get(id, userId) as FoodItemRow | undefined;
    return row ? rowToFoodItem(row) : null;
  }

  async findAll(userId: string, filter?: FoodItemFilter): Promise<FoodItem[]> {
    const { where, params } = buildWhereClause(userId, filter);
    const rows = this.db
      .prepare(`SELECT * FROM food_items ${where} ORDER BY best_before ASC`)
      .all(params) as FoodItemRow[];

    return rows.map(rowToFoodItem);
  }

  async findAllPaginated(
    userId: string,
    filter: FoodItemFilter,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<FoodItem>> {
    const { where, params } = buildWhereClause(userId, filter);

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
    userId: string,
    name: string,
    location: Location,
    excludeId?: string,
  ): Promise<FoodItem | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM food_items
         WHERE lower(name) = lower(@name) AND location = @location AND user_id = @userId AND id != @excludeId`,
      )
      .get({ name, location, userId, excludeId: excludeId ?? '' }) as FoodItemRow | undefined;
    return row ? rowToFoodItem(row) : null;
  }

  async update(id: string, userId: string, input: UpdateFoodItemInput): Promise<FoodItem | null> {
    const existing = await this.findById(id, userId);
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
         WHERE id = @id AND user_id = @user_id`,
      )
      .run({
        id: updated.id,
        user_id: updated.userId,
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

  async delete(id: string, userId: string): Promise<boolean> {
    const result = this.db
      .prepare('DELETE FROM food_items WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
