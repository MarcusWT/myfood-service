import type { Migration } from './migration-runner.js';

/**
 * Enforces uniqueness of active items per (user, lower(name), location).
 * Pre-existing active duplicates are never deleted: the oldest is kept and
 * the others are marked DISCARDED with an explanatory note.
 */
export const uniqueActiveFoodItemNameMigration: Migration = {
  id: 6,
  name: 'unique-active-food-item-name',
  up: (db) => {
    const groups = db
      .prepare(
        `SELECT user_id, lower(name) AS lname, location FROM food_items
         WHERE disposition IS NULL
         GROUP BY user_id, lower(name), location HAVING COUNT(*) > 1`,
      )
      .all() as { user_id: string | null; lname: string; location: string }[];

    const members = db.prepare(
      `SELECT id FROM food_items
       WHERE disposition IS NULL AND user_id IS @user_id AND lower(name) = @lname AND location = @location
       ORDER BY added_at ASC, rowid ASC`,
    );
    const discard = db.prepare(
      `UPDATE food_items
       SET disposition = 'DISCARDED', disposed_at = @now, updated_at = @now,
           notes = COALESCE(notes, '') || @suffix
       WHERE id = @id`,
    );
    const now = new Date().toISOString();

    for (const g of groups) {
      const rows = members.all(g) as { id: string }[];
      const [keeper, ...losers] = rows;
      for (const loser of losers) {
        discard.run({
          id: loser.id,
          now,
          suffix: ` [migration 006: duplicate of ${keeper.id}]`,
        });
      }
    }

    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_food_items_unique_active_name_location
       ON food_items(user_id, lower(name), location) WHERE disposition IS NULL`,
    );
  },
};
