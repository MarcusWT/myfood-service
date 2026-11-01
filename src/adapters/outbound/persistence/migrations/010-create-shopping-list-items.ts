import type { Migration } from './migration-runner.js';

export const createShoppingListItemsMigration: Migration = {
  id: 10,
  name: 'create-shopping-list-items',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS shopping_list_items (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        name       TEXT NOT NULL,
        quantity   REAL,
        unit       TEXT,
        category   TEXT NOT NULL,
        checked    INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_shopping_list_user ON shopping_list_items(user_id, created_at)',
    );
  },
};
