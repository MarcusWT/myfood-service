import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { ExpiryAlert } from '../../../../core/domain/expiry-alert.js';
import type { NotificationLogPort } from '../../../../core/ports/outbound/notification-log.port.js';
import { InMemoryNotificationLogRepository } from '../notification-log.in-memory.repository.js';
import { SqliteNotificationLogRepository } from '../notification-log.sqlite.repository.js';
import { allMigrations, runMigrations } from '../migrations/index.js';

const mk = (id: string, status: ExpiryAlert['status'] = 'CRITICAL'): ExpiryAlert =>
  ({ item: { id }, daysUntilExpiry: 1, status }) as unknown as ExpiryAlert;

const dirs: string[] = [];
const tmpDb = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nlog-'));
  dirs.push(d);
  return path.join(d, 'test.db');
};
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

const suites: [string, () => NotificationLogPort][] = [
  ['in-memory', () => new InMemoryNotificationLogRepository()],
  ['sqlite', () => new SqliteNotificationLogRepository(tmpDb())],
];

describe.each(suites)('NotificationLog (%s)', (_n, make) => {
  it('filters sent alerts by user, item, status and day', async () => {
    const log = make();
    await log.markSent('u1', [mk('a')], '2026-01-01');
    const all = [mk('a'), mk('a', 'EXPIRED'), mk('b')];
    expect((await log.filterUnsent('u1', all, '2026-01-01')).map((x) => x.item.id + x.status)).toEqual([
      'aEXPIRED',
      'bCRITICAL',
    ]);
    expect(await log.filterUnsent('u2', [mk('a')], '2026-01-01')).toHaveLength(1);
    expect(await log.filterUnsent('u1', [mk('a')], '2026-01-02')).toHaveLength(1);
  });

  it('markSent is idempotent and pruneBefore removes older days only', async () => {
    const log = make();
    await log.markSent('u1', [mk('a')], '2026-01-01');
    await log.markSent('u1', [mk('a')], '2026-01-01');
    await log.markSent('u1', [mk('a')], '2026-01-05');
    expect(await log.pruneBefore('2026-01-05')).toBe(1);
    expect(await log.filterUnsent('u1', [mk('a')], '2026-01-05')).toHaveLength(0);
    expect(await log.filterUnsent('u1', [mk('a')], '2026-01-01')).toHaveLength(1);
  });
});

describe('SqliteNotificationLogRepository persistence & migration 007', () => {
  it('persists across reopen', async () => {
    const p = tmpDb();
    const a = new SqliteNotificationLogRepository(p);
    await a.markSent('u1', [mk('a')], '2026-01-01');
    a.close();
    const b = new SqliteNotificationLogRepository(p);
    expect(await b.filterUnsent('u1', [mk('a')], '2026-01-01')).toHaveLength(0);
    b.close();
  });

  it('migration 007 is idempotent', () => {
    const db = new Database(':memory:');
    runMigrations(db, allMigrations);
    allMigrations.find((m) => m.id === 7)!.up(db);
    runMigrations(db, allMigrations);
    expect(db.prepare('SELECT count(*) c FROM notifications_sent').get()).toEqual({ c: 0 });
  });
});
