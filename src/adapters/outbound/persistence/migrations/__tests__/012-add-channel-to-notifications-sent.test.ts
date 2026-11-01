import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, allMigrations } from '../index.js';

describe('migration 012', () => {
  it('adds channel preserving existing rows, and is idempotent', () => {
    const db = new Database(':memory:');
    runMigrations(db, allMigrations.filter((m) => m.id <= 11));
    db.prepare("INSERT INTO notifications_sent VALUES ('u','i','CRITICAL','2026-09-01','t')").run();
    runMigrations(db, allMigrations);
    runMigrations(db, allMigrations);
    const rows = db.prepare('SELECT channel FROM notifications_sent').all();
    expect(rows).toEqual([{ channel: '' }]);
    db.prepare("INSERT INTO notifications_sent VALUES ('u','i','CRITICAL','2026-09-01','t','webhook')").run();
  });
});
