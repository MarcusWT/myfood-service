import type Database from 'better-sqlite3';
import type { Migration } from './migration-runner.js';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return columns.some((c) => c.name === column);
}

/**
 * Adds `disposition` (CONSUMED | DISCARDED) and `disposed_at` columns so items
 * can be retired without hard-deleting them. NULL disposition means active.
 */
export const addDispositionMigration: Migration = {
  id: 5,
  name: 'add-disposition',
  up: (db) => {
    if (!hasColumn(db, 'food_items', 'disposition')) {
      db.exec('ALTER TABLE food_items ADD COLUMN disposition TEXT');
    }
    if (!hasColumn(db, 'food_items', 'disposed_at')) {
      db.exec('ALTER TABLE food_items ADD COLUMN disposed_at TEXT');
    }
  },
};
