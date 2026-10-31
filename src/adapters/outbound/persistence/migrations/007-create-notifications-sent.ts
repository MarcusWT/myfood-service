import type { Migration } from './migration-runner.js';

export const createNotificationsSentMigration: Migration = {
  id: 7,
  name: 'create-notifications-sent',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications_sent (
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        status  TEXT NOT NULL,
        day     TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        PRIMARY KEY (user_id, item_id, status, day)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_sent_day ON notifications_sent(day)');
  },
};
