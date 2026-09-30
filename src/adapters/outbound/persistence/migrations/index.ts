import type { Migration } from './migration-runner.js';
import { createFoodItemsMigration } from './001-create-food-items.js';
import { addMinimumQuantityMigration } from './002-add-minimum-quantity.js';
import { addUserIdToFoodItemsMigration } from './003-add-user-id-to-food-items.js';
import { createUsersMigration } from './004-create-users.js';

export type { Migration };
export { runMigrations } from './migration-runner.js';

/**
 * The full, ordered list of migrations for the application's SQLite
 * database. Both `SqliteFoodItemRepository` and `SqliteUserRepository` open
 * a connection to the same underlying database file and run this same full
 * list (rather than each running a distinct subset) so that a fresh
 * database always ends up with the complete, identical schema regardless
 * of which repository happens to be constructed first, and so that
 * `schema_migrations` reflects one consistent, shared history for the
 * whole database file.
 */
export const allMigrations: Migration[] = [
  createFoodItemsMigration,
  addMinimumQuantityMigration,
  addUserIdToFoodItemsMigration,
  createUsersMigration,
];
