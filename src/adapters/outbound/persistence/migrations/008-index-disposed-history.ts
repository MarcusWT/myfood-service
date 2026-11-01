import type { Migration } from './migration-runner.js';

export const indexDisposedHistoryMigration: Migration = {
  id: 8,
  name: 'index-disposed-history',
  up: (db) => {
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_food_items_disposed
       ON food_items(user_id, disposed_at) WHERE disposition IS NOT NULL`,
    );
  },
};
