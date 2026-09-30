import type Database from 'better-sqlite3';
import type { Migration } from './migration-runner.js';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return columns.some((c) => c.name === column);
}

/**
 * Adds the `user_id` column (and its index) used to scope food items to a
 * user (item 11). Safe to run against a database that already has the
 * column (e.g. previously migrated via the old ad-hoc guard), in which case
 * adding the column is a no-op and the index creation is already
 * idempotent via `CREATE INDEX IF NOT EXISTS`.
 *
 * Note: this migration does NOT include the orphaned-row (`user_id IS
 * NULL`) safety check — that's a runtime invariant that must be
 * re-evaluated on every server startup (e.g. if rows are later
 * manually reset to NULL), not a one-time schema change. It's enforced by
 * `SqliteFoodItemRepository` on every construction, independent of whether
 * this migration has already been recorded as applied.
 */
export const addUserIdToFoodItemsMigration: Migration = {
  id: 3,
  name: 'add-user-id-to-food-items',
  up: (db) => {
    if (!hasColumn(db, 'food_items', 'user_id')) {
      db.exec('ALTER TABLE food_items ADD COLUMN user_id TEXT');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_food_items_user_id ON food_items(user_id)');
  },
};
