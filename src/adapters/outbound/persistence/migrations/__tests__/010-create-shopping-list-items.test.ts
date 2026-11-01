import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { allMigrations, runMigrations } from '../index.js';

describe('migration 010 create-shopping-list-items', () => {
  it('creates the table and index idempotently', () => {
    const db = new Database(':memory:');
    runMigrations(db, allMigrations);
    runMigrations(db, allMigrations);
    const cols = (db.prepare('PRAGMA table_info(shopping_list_items)').all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(cols).toEqual([
      'id', 'user_id', 'name', 'quantity', 'unit', 'category', 'checked', 'created_at', 'updated_at',
    ]);
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE name = 'idx_shopping_list_user'").get();
    expect(idx).toBeDefined();
    expect(allMigrations.map((m) => m.id)).toEqual([...allMigrations.map((m) => m.id)].sort((a, b) => a - b));
  });
});
