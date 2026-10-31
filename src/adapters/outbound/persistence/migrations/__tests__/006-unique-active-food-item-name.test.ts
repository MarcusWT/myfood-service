import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, allMigrations } from '../index.js';

function insert(db: Database.Database, id: string, name: string, location: string, user: string, addedAt: string, disposition: string | null = null) {
  db.prepare(
    `INSERT INTO food_items (id, user_id, name, quantity, unit, location, category, best_before, added_at, updated_at, notes, disposition)
     VALUES (?, ?, ?, 1, 'UNITS', ?, 'OTHER', '2026-09-01', ?, ?, 'orig', ?)`,
  ).run(id, user, name, location, addedAt, addedAt, disposition);
}

describe('migration 006', () => {
  const setup = () => {
    const db = new Database(':memory:');
    runMigrations(db, allMigrations.filter((m) => m.id <= 5));
    insert(db, 'a', 'Milk', 'FRIDGE', 'u1', '2026-01-01');
    insert(db, 'b', 'milk', 'FRIDGE', 'u1', '2026-01-02');
    insert(db, 'c', 'MILK', 'FRIDGE', 'u1', '2026-01-03');
    insert(db, 'd', 'Milk', 'FREEZER', 'u1', '2026-01-04');
    insert(db, 'e', 'Milk', 'FRIDGE', 'u2', '2026-01-05');
    insert(db, 'f', 'Milk', 'FRIDGE', 'u1', '2026-01-06', 'CONSUMED');
    return db;
  };
  const state = (db: Database.Database) =>
    db.prepare('SELECT id, disposition, notes FROM food_items ORDER BY id').all() as {
      id: string; disposition: string | null; notes: string;
    }[];

  it('discards later duplicates, keeps oldest, and is idempotent', () => {
    const db = setup();
    runMigrations(db, allMigrations);
    const rows = state(db);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.a.disposition).toBeNull();
    for (const id of ['b', 'c']) {
      expect(by[id].disposition).toBe('DISCARDED');
      expect(by[id].notes).toBe('orig [migration 006: duplicate of a]');
    }
    expect(by.d.disposition).toBeNull();
    expect(by.e.disposition).toBeNull();
    expect(by.f.disposition).toBe('CONSUMED');
    expect(by.f.notes).toBe('orig');

    const before = state(db);
    allMigrations.find((m) => m.id === 6)!.up(db);
    expect(state(db)).toEqual(before);
  });

  it('enforces uniqueness afterwards, but allows reuse of a disposed name', () => {
    const db = setup();
    runMigrations(db, allMigrations);
    expect(() => insert(db, 'g', 'mILK', 'FRIDGE', 'u1', '2026-02-01')).toThrow(/UNIQUE/);
    db.prepare("UPDATE food_items SET disposition='CONSUMED' WHERE id='a'").run();
    expect(() => insert(db, 'g', 'Milk', 'FRIDGE', 'u1', '2026-02-01')).not.toThrow();
  });
});
