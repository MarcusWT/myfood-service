import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteHealthCheckAdapter } from '../health-check.sqlite.adapter.js';

describe('SqliteHealthCheckAdapter', () => {
  let db: Database.Database;

  afterEach(() => {
    db?.close();
  });

  it('returns true when the connection can run a trivial query', async () => {
    db = new Database(':memory:');
    const adapter = new SqliteHealthCheckAdapter(db);

    await expect(adapter.checkReadiness()).resolves.toBe(true);
  });

  it('returns false when the connection is closed/unusable', async () => {
    db = new Database(':memory:');
    db.close();
    const adapter = new SqliteHealthCheckAdapter(db);

    await expect(adapter.checkReadiness()).resolves.toBe(false);
  });
});
