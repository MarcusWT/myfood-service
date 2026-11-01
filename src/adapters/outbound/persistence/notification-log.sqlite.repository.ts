import Database from 'better-sqlite3';
import { ExpiryAlert } from '../../../core/domain/expiry-alert.js';
import { NotificationLogPort } from '../../../core/ports/outbound/notification-log.port.js';
import { runMigrations, allMigrations } from './migrations/index.js';

export class SqliteNotificationLogRepository implements NotificationLogPort {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('journal_mode = WAL');
    runMigrations(this.db, allMigrations);
  }

  async filterUnsent(userId: string, alerts: ExpiryAlert[], day: string, channel = ''): Promise<ExpiryAlert[]> {
    const stmt = this.db.prepare(
      'SELECT 1 FROM notifications_sent WHERE user_id = ? AND item_id = ? AND status = ? AND day = ? AND channel = ?',
    );
    return alerts.filter((a) => !stmt.get(userId, a.item.id, a.status, day, channel));
  }

  async markSent(userId: string, alerts: ExpiryAlert[], day: string, channel = ''): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO notifications_sent (user_id, item_id, status, day, sent_at, channel)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const sentAt = new Date().toISOString();
    this.db.transaction(() => {
      for (const a of alerts) stmt.run(userId, a.item.id, a.status, day, sentAt, channel);
    })();
  }

  async pruneBefore(day: string): Promise<number> {
    return this.db.prepare('DELETE FROM notifications_sent WHERE day < ?').run(day).changes;
  }

  close(): void {
    this.db.close();
  }
}
