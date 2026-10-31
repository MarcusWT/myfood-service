import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assignOrphanedFoodItems } from '../assign-orphaned-items.js';
import { SqliteFoodItemRepository } from '../food-item.sqlite.repository.js';
import { allMigrations } from '../migrations/index.js';
import { runMigrations } from '../migrations/migration-runner.js';
import { main } from '../../../../cli/assign-orphaned-items.js';

const USER_ID = 'user-1';

function insertItem(db: Database.Database, id: string, name: string, userId: string | null) {
  db.prepare(
    `INSERT INTO food_items (id, name, quantity, unit, location, category, best_before, added_at, updated_at, user_id)
     VALUES (?, ?, 1, 'UNITS', 'FRIDGE', 'OTHER', '2099-01-01', ?, '2020-01-01', ?)`,
  ).run(id, name, `2020-01-0${id.length}`, userId);
}

describe('assignOrphanedFoodItems', () => {
  let dir: string;
  let path: string;

  /** Legacy pre-auth DB with orphans, run through the migrations (guard not yet run). */
  function setup(): Database.Database {
    const db = new Database(path);
    db.exec(`
      CREATE TABLE food_items (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL,
        location TEXT NOT NULL, category TEXT NOT NULL, best_before TEXT NOT NULL,
        added_at TEXT NOT NULL, updated_at TEXT NOT NULL, notes TEXT, minimum_quantity REAL
      )
    `);
    db.prepare(
      `INSERT INTO food_items (id, name, quantity, unit, location, category, best_before, added_at, updated_at)
       VALUES ('o1', 'Old Eggs', 1, 'UNITS', 'FRIDGE', 'OTHER', '2099-01-01', '2020-01-01', '2020-01-01')`,
    ).run();
    db.prepare(
      `INSERT INTO food_items (id, name, quantity, unit, location, category, best_before, added_at, updated_at)
       VALUES ('o22', 'Milk', 1, 'UNITS', 'FRIDGE', 'OTHER', '2099-01-01', '2020-01-02', '2020-01-02')`,
    ).run();
    runMigrations(db, allMigrations);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, created_at) VALUES (?, 'Me@Example.com', 'x', '2020')`,
    ).run(USER_ID);
    return db;
  }

  const count = (db: Database.Database, where: string) =>
    (db.prepare(`SELECT COUNT(*) c FROM food_items WHERE ${where}`).get() as { c: number }).c;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'myfood-service-test-'));
    path = join(dir, 'legacy.db');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('guard throws with CLI hint, helper fixes it, repo then starts', async () => {
    const db = setup();
    db.close();
    expect(() => new SqliteFoodItemRepository(path)).toThrow(/assign-orphans/);

    const db2 = new Database(path);
    const result = assignOrphanedFoodItems(db2, { email: 'me@example.com' });
    expect(result).toEqual({ userId: USER_ID, count: 2, discardedDuplicates: 0 });
    db2.close();

    const repo = new SqliteFoodItemRepository(path);
    expect((await repo.findAll(USER_ID)).map((i) => i.id).sort()).toEqual(['o1', 'o22']);
    repo.close();
  });

  it('dry run changes nothing; unknown email throws and changes nothing', () => {
    const db = setup();
    expect(assignOrphanedFoodItems(db, { email: 'me@example.com', dryRun: true }).count).toBe(2);
    expect(count(db, 'user_id IS NULL')).toBe(2);
    expect(() => assignOrphanedFoodItems(db, { email: 'nobody@example.com' })).toThrow(/No user/);
    expect(count(db, 'user_id IS NULL')).toBe(2);
    db.close();
  });

  it('soft-discards orphans that collide with the user items or each other; rerun is a no-op', () => {
    const db = setup();
    insertItem(db, 'mine', 'old eggs', USER_ID);
    insertItem(db, 'o333', 'MILK', null);
    // 006 already ran with orphans present: o22/o333 were duplicates, so 006 discarded one.
    db.prepare("UPDATE food_items SET disposition = NULL, disposed_at = NULL WHERE id = 'o333'").run();
    const result = assignOrphanedFoodItems(db, { email: 'me@example.com' });
    expect(result.count).toBe(3);
    expect(result.discardedDuplicates).toBe(2); // o1 (vs mine) and o333 (vs o22)
    const o1 = db.prepare("SELECT disposition, notes FROM food_items WHERE id = 'o1'").get() as {
      disposition: string;
      notes: string;
    };
    expect(o1.disposition).toBe('DISCARDED');
    expect(o1.notes).toContain('duplicate of mine');
    expect(count(db, "id = 'mine' AND disposition IS NULL")).toBe(1);
    expect(assignOrphanedFoodItems(db, { email: 'me@example.com' }).count).toBe(0);
    db.close();
  });

  describe('main', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('refuses :memory:, missing/unknown args, and succeeds on a real DB', () => {
      expect(main(['--email', 'a@b.c'], { DB_PATH: ':memory:' })).toBe(1);
      expect(main([], { DB_PATH: path })).toBe(1);
      expect(main(['--bogus'], { DB_PATH: path })).toBe(1);
      setup().close();
      expect(main(['--email', 'me@example.com', '--dry-run'], { DB_PATH: path })).toBe(0);
      expect(main(['--email', 'me@example.com'], { DB_PATH: path })).toBe(0);
      const db = new Database(path);
      expect(count(db, 'user_id IS NULL')).toBe(0);
      db.close();
    });
  });
});
