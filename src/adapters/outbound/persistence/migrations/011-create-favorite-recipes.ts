import type { Migration } from './migration-runner.js';

export const createFavoriteRecipesMigration: Migration = {
  id: 11,
  name: 'create-favorite-recipes',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS favorite_recipes (
        user_id    TEXT NOT NULL,
        recipe_id  INTEGER NOT NULL,
        title      TEXT NOT NULL,
        image_url  TEXT,
        source_url TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, recipe_id)
      )
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_favorite_recipes_user_created ON favorite_recipes(user_id, created_at)',
    );
  },
};
