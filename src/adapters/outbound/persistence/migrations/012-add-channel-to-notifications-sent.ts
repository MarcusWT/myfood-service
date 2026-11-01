import type { Migration } from './migration-runner.js';

export const addChannelToNotificationsSentMigration: Migration = {
  id: 12,
  name: 'add-channel-to-notifications-sent',
  up: (db) => {
    const cols = db.prepare('PRAGMA table_info(notifications_sent)').all() as { name: string }[];
    if (cols.some((c) => c.name === 'channel')) return;
    db.exec(`
      CREATE TABLE notifications_sent_new (
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        status  TEXT NOT NULL,
        day     TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (user_id, item_id, status, day, channel)
      );
      INSERT INTO notifications_sent_new (user_id, item_id, status, day, sent_at)
        SELECT user_id, item_id, status, day, sent_at FROM notifications_sent;
      DROP TABLE notifications_sent;
      ALTER TABLE notifications_sent_new RENAME TO notifications_sent;
      CREATE INDEX IF NOT EXISTS idx_notifications_sent_day ON notifications_sent(day);
    `);
  },
};
