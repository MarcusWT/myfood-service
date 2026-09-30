import type Database from 'better-sqlite3';
import type { Migration } from './migration-runner.js';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return columns.some((c) => c.name === column);
}

/**
 * Adds the `minimum_quantity` column used for low-stock tracking (item 8).
 * Safe to run against a database that already has the column (e.g. one
 * migrated previously via the old ad-hoc `PRAGMA table_info` + `ALTER TABLE`
 * guard in `SqliteFoodItemRepository`), in which case it's a no-op.
 */
export const addMinimumQuantityMigration: Migration = {
  id: 2,
  name: 'add-minimum-quantity',
  up: (db) => {
    if (!hasColumn(db, 'food_items', 'minimum_quantity')) {
      db.exec('ALTER TABLE food_items ADD COLUMN minimum_quantity REAL');
    }
  },
};
