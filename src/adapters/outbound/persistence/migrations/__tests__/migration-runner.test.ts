import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, type Migration } from '../migration-runner.js';

function makeMigration(id: number, name: string, up: Migration['up']): Migration {
  return { id, name, up };
}

describe('runMigrations', () => {
  it('applies pending migrations in order and records them in schema_migrations', () => {
    const db = new Database(':memory:');
    const order: number[] = [];

    const migrations: Migration[] = [
      makeMigration(2, 'second', (d) => {
        order.push(2);
        d.exec('CREATE TABLE IF NOT EXISTS second_table (id TEXT)');
      }),
      makeMigration(1, 'first', (d) => {
        order.push(1);
        d.exec('CREATE TABLE IF NOT EXISTS first_table (id TEXT)');
      }),
    ];

    runMigrations(db, migrations);

    expect(order).toEqual([1, 2]);

    const rows = db
      .prepare('SELECT id, name FROM schema_migrations ORDER BY id ASC')
      .all() as { id: number; name: string }[];
    expect(rows).toEqual([
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
    ]);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['first_table', 'second_table', 'schema_migrations']),
    );

    db.close();
  });

  it('skips already-applied migrations and only runs pending ones', () => {
    const db = new Database(':memory:');
    let runCount = 0;

    const migrations: Migration[] = [
      makeMigration(1, 'first', () => {
        runCount += 1;
      }),
    ];

    runMigrations(db, migrations);
    expect(runCount).toBe(1);

    // Run again with the same (and an additional) migration — the first
    // should be skipped since it's already recorded as applied.
    const secondRunMigrations: Migration[] = [
      ...migrations,
      makeMigration(2, 'second', () => {
        runCount += 1;
      }),
    ];
    runMigrations(db, secondRunMigrations);

    expect(runCount).toBe(2);

    const rows = db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[];
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);

    db.close();
  });

  it('wraps the whole pending-migrations pass in one transaction so a failing migration leaves no partial state', () => {
    const db = new Database(':memory:');

    const migrations: Migration[] = [
      makeMigration(1, 'partial-failure', (d) => {
        d.exec('CREATE TABLE IF NOT EXISTS partial_table (id TEXT)');
        throw new Error('boom');
      }),
    ];

    expect(() => runMigrations(db, migrations)).toThrow('boom');

    // The CREATE TABLE should have been rolled back along with the failed
    // migration, since both were inside the same transaction.
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).not.toContain('partial_table');

    const rows = db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[];
    expect(rows).toEqual([]);

    db.close();
  });

  it('rolls back the entire batch, including earlier successful migrations from the same run, if a later one fails', () => {
    const db = new Database(':memory:');

    const migrations: Migration[] = [
      makeMigration(1, 'first-succeeds', (d) => {
        d.exec('CREATE TABLE IF NOT EXISTS first_table (id TEXT)');
      }),
      makeMigration(2, 'second-fails', (d) => {
        d.exec('CREATE TABLE IF NOT EXISTS second_table (id TEXT)');
        throw new Error('boom');
      }),
    ];

    expect(() => runMigrations(db, migrations)).toThrow('boom');

    // Both migration 1's table AND migration 2's table should be rolled
    // back, since the whole pending-migrations pass is one transaction.
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).not.toContain('first_table');
    expect(tables.map((t) => t.name)).not.toContain('second_table');

    const rows = db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[];
    expect(rows).toEqual([]);

    db.close();
  });

  it('does not re-run or fail on migrations that are idempotent-safe against pre-existing schema', () => {
    const db = new Database(':memory:');
    // Simulate a table already created outside the migration system (as if
    // by an old ad-hoc guard), with no schema_migrations record.
    db.exec('CREATE TABLE food_items (id TEXT PRIMARY KEY, name TEXT)');

    const migrations: Migration[] = [
      makeMigration(1, 'create-food-items', (d) => {
        d.exec('CREATE TABLE IF NOT EXISTS food_items (id TEXT PRIMARY KEY, name TEXT)');
      }),
    ];

    expect(() => runMigrations(db, migrations)).not.toThrow();

    const rows = db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[];
    expect(rows).toEqual([{ id: 1 }]);

    db.close();
  });
});
