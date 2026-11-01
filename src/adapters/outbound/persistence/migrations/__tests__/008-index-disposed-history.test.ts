import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, allMigrations } from '../index.js';

describe('migration 008', () => {
  it('creates the disposed index and is idempotent', () => {
    const db = new Database(':memory:');
    runMigrations(db, allMigrations);
    runMigrations(db, allMigrations);
    const idx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_food_items_disposed'")
      .get();
    expect(idx).toBeTruthy();
    expect(allMigrations.map((m) => m.id)).toEqual([...allMigrations.map((m) => m.id)].sort((a, b) => a - b));
  });
});
