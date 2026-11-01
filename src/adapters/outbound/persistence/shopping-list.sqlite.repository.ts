import Database from 'better-sqlite3';
import { ShoppingListItem, UpdateShoppingListItemInput } from '../../../core/domain/shopping-list.js';
import { ShoppingListRepositoryPort } from '../../../core/ports/outbound/shopping-list.repository.port.js';
import { runMigrations, allMigrations } from './migrations/index.js';

interface Row {
  id: string;
  user_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  checked: number;
  created_at: string;
  updated_at: string;
}

function toItem(r: Row): ShoppingListItem {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    quantity: r.quantity ?? undefined,
    unit: (r.unit ?? undefined) as ShoppingListItem['unit'],
    category: r.category as ShoppingListItem['category'],
    checked: r.checked === 1,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export class SqliteShoppingListRepository implements ShoppingListRepositoryPort {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('journal_mode = WAL');
    runMigrations(this.db, allMigrations);
  }

  async findAll(userId: string): Promise<ShoppingListItem[]> {
    const rows = this.db
      .prepare('SELECT * FROM shopping_list_items WHERE user_id = ? ORDER BY created_at, rowid')
      .all(userId) as Row[];
    return rows.map(toItem);
  }

  async findById(userId: string, id: string): Promise<ShoppingListItem | null> {
    const row = this.db
      .prepare('SELECT * FROM shopping_list_items WHERE user_id = ? AND id = ?')
      .get(userId, id) as Row | undefined;
    return row ? toItem(row) : null;
  }

  async create(item: ShoppingListItem): Promise<ShoppingListItem> {
    this.db
      .prepare(
        `INSERT INTO shopping_list_items
         (id, user_id, name, quantity, unit, category, checked, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        item.id,
        item.userId,
        item.name,
        item.quantity ?? null,
        item.unit ?? null,
        item.category,
        item.checked ? 1 : 0,
        item.createdAt.toISOString(),
        item.updatedAt.toISOString(),
      );
    return item;
  }

  private insertSql = `INSERT INTO shopping_list_items
         (id, user_id, name, quantity, unit, category, checked, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE (SELECT COUNT(*) FROM shopping_list_items WHERE user_id = ?) < ?`;

  private insertIfUnder(item: ShoppingListItem, max: number): boolean {
    return (
      this.db
        .prepare(this.insertSql)
        .run(
          item.id,
          item.userId,
          item.name,
          item.quantity ?? null,
          item.unit ?? null,
          item.category,
          item.checked ? 1 : 0,
          item.createdAt.toISOString(),
          item.updatedAt.toISOString(),
          item.userId,
          max,
        ).changes > 0
    );
  }

  async createIfUnderLimit(item: ShoppingListItem, max: number): Promise<ShoppingListItem | null> {
    return this.insertIfUnder(item, max) ? item : null;
  }

  async createManyIfUnderLimit(
    items: ShoppingListItem[],
    max: number,
  ): Promise<ShoppingListItem[] | null> {
    class Rollback extends Error {}
    try {
      this.db
        .transaction(() => {
          for (const item of items) {
            if (!this.insertIfUnder(item, max)) throw new Rollback();
          }
        })
        .immediate();
      return items;
    } catch (e) {
      if (e instanceof Rollback) return null;
      throw e;
    }
  }

  async update(
    userId: string,
    id: string,
    patch: UpdateShoppingListItemInput,
  ): Promise<ShoppingListItem | null> {
    const cur = await this.findById(userId, id);
    if (!cur) return null;
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const next: ShoppingListItem = { ...cur, ...defined, updatedAt: new Date() };
    this.db
      .prepare(
        `UPDATE shopping_list_items
         SET name = ?, quantity = ?, unit = ?, category = ?, checked = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`,
      )
      .run(
        next.name,
        next.quantity ?? null,
        next.unit ?? null,
        next.category,
        next.checked ? 1 : 0,
        next.updatedAt.toISOString(),
        userId,
        id,
      );
    return next;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    return (
      this.db.prepare('DELETE FROM shopping_list_items WHERE user_id = ? AND id = ?').run(userId, id)
        .changes > 0
    );
  }

  async deleteChecked(userId: string): Promise<number> {
    return this.db
      .prepare('DELETE FROM shopping_list_items WHERE user_id = ? AND checked = 1')
      .run(userId).changes;
  }

  async countByUser(userId: string): Promise<number> {
    const r = this.db
      .prepare('SELECT COUNT(*) AS n FROM shopping_list_items WHERE user_id = ?')
      .get(userId) as { n: number };
    return r.n;
  }

  close(): void {
    this.db.close();
  }
}
