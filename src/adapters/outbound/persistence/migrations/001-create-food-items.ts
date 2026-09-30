import type { Migration } from './migration-runner.js';

/**
 * Original `food_items` schema, before `minimum_quantity` (item 8) and
 * `user_id` (item 11) were added. Encodes the schema as it existed prior to
 * any ad-hoc `ALTER TABLE` guards.
 */
export const createFoodItemsMigration: Migration = {
  id: 1,
  name: 'create-food-items',
  up: (db) => {
    db.exec(`
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
        notes       TEXT
      )
    `);
  },
};
