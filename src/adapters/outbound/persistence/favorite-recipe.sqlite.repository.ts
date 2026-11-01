import Database from 'better-sqlite3';
import { FavoriteRecipe } from '../../../core/domain/favorite-recipe.js';
import { FavoriteRecipeRepositoryPort } from '../../../core/ports/outbound/favorite-recipe.repository.port.js';
import { runMigrations, allMigrations } from './migrations/index.js';

interface Row {
  recipe_id: number;
  title: string;
  image_url: string | null;
  source_url: string | null;
  created_at: string;
}

function toFavorite(row: Row): FavoriteRecipe {
  return {
    recipeId: row.recipe_id,
    title: row.title,
    ...(row.image_url !== null ? { imageUrl: row.image_url } : {}),
    ...(row.source_url !== null ? { sourceUrl: row.source_url } : {}),
    createdAt: new Date(row.created_at),
  };
}

export class SqliteFavoriteRecipeRepository implements FavoriteRecipeRepositoryPort {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('journal_mode = WAL');
    runMigrations(this.db, allMigrations);
  }

  async list(userId: string): Promise<FavoriteRecipe[]> {
    const rows = this.db
      .prepare(
        `SELECT recipe_id, title, image_url, source_url, created_at FROM favorite_recipes
         WHERE user_id = ? ORDER BY created_at DESC, rowid DESC`,
      )
      .all(userId) as Row[];
    return rows.map(toFavorite);
  }

  async upsert(userId: string, f: FavoriteRecipe): Promise<FavoriteRecipe> {
    this.db
      .prepare(
        `INSERT INTO favorite_recipes (user_id, recipe_id, title, image_url, source_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, recipe_id) DO UPDATE SET
           title = excluded.title, image_url = excluded.image_url, source_url = excluded.source_url`,
      )
      .run(userId, f.recipeId, f.title, f.imageUrl ?? null, f.sourceUrl ?? null, f.createdAt.toISOString());
    const row = this.db
      .prepare(
        'SELECT recipe_id, title, image_url, source_url, created_at FROM favorite_recipes WHERE user_id = ? AND recipe_id = ?',
      )
      .get(userId, f.recipeId) as Row;
    return toFavorite(row);
  }

  async remove(userId: string, recipeId: number): Promise<boolean> {
    return (
      this.db.prepare('DELETE FROM favorite_recipes WHERE user_id = ? AND recipe_id = ?').run(userId, recipeId)
        .changes > 0
    );
  }

  async ids(userId: string): Promise<Set<number>> {
    const rows = this.db.prepare('SELECT recipe_id FROM favorite_recipes WHERE user_id = ?').all(userId) as {
      recipe_id: number;
    }[];
    return new Set(rows.map((r) => r.recipe_id));
  }

  close(): void {
    this.db.close();
  }
}
