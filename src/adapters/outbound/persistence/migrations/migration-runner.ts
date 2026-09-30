import type Database from 'better-sqlite3';

export interface Migration {
  id: number;
  name: string;
  up: (db: Database.Database) => void;
}

const CREATE_SCHEMA_MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    applied_at  TEXT NOT NULL
  )
`;

/**
 * Hand-rolled numbered-migrations runner for `better-sqlite3`.
 *
 * Idempotency/backfill strategy: rather than running a separate one-time
 * "detect what's already there and backfill `schema_migrations`" pass, each
 * migration's `up()` function is written to be idempotent-safe on its own
 * (`CREATE TABLE IF NOT EXISTS`, checking `PRAGMA table_info` before
 * `ALTER TABLE ... ADD COLUMN`, `CREATE INDEX IF NOT EXISTS`, etc.). This
 * means it is always safe to *run* a migration against a database that
 * already has that schema change physically applied (via the old ad-hoc
 * guards, or from a previous run) — it's just a no-op. That lets the runner
 * stay simple: it only needs to track which migration ids it has already
 * recorded as applied, and run+record any pending ones. No special-casing
 * or detection logic is needed in the runner itself, and there's no risk of
 * the backfill-detection logic itself drifting out of sync with what the
 * migrations actually do.
 *
 * Concurrency: the entire "read applied ids -> run pending -> record" pass
 * runs inside a single EXCLUSIVE transaction, so only one connection can be
 * running migrations against a given database file at a time. Without this,
 * two processes/connections starting against the same file concurrently
 * (e.g. multiple replicas sharing a mounted SQLite file) could both read an
 * empty/stale `schema_migrations` table before either commits, then both
 * attempt to apply and record the same migration id — this was reproduced
 * and confirmed to crash all racing processes before this fix (concurrent
 * `UNIQUE constraint failed: schema_migrations.id` / `database is locked`
 * errors). An EXCLUSIVE transaction forces other connections to wait for
 * the lock (or fail with SQLITE_BUSY, retried by better-sqlite3's default
 * busy timeout) rather than interleaving reads and writes.
 *
 * Each migration is independently transactional in the sense that the
 * overall pass is one transaction: if migration N fails, the EXCLUSIVE
 * transaction is rolled back in its entirety, including any earlier
 * migrations applied earlier in the *same* run — so a failed run never
 * leaves partially-applied migrations committed to disk. A subsequent
 * retry (e.g. process restart) starts over from the last successfully
 * committed state.
 */
export function runMigrations(db: Database.Database, migrations: Migration[]): void {
  db.exec(CREATE_SCHEMA_MIGRATIONS_TABLE_SQL);

  const insertApplied = db.prepare(
    'INSERT INTO schema_migrations (id, name, applied_at) VALUES (@id, @name, @applied_at)',
  );

  const applyPending = db.transaction(() => {
    const appliedIds = new Set(
      (db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[]).map(
        (row) => row.id,
      ),
    );

    const pending = [...migrations]
      .sort((a, b) => a.id - b.id)
      .filter((m) => !appliedIds.has(m.id));

    for (const migration of pending) {
      migration.up(db);
      insertApplied.run({
        id: migration.id,
        name: migration.name,
        applied_at: new Date().toISOString(),
      });
    }
  });

  applyPending.exclusive();
}
