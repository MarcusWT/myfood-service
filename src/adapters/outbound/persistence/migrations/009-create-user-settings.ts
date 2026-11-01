import type { Migration } from './migration-runner.js';

export const createUserSettingsMigration: Migration = {
  id: 9,
  name: 'create-user-settings',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id           TEXT PRIMARY KEY,
        alert_within_days INTEGER,
        diet              TEXT,
        intolerances      TEXT NOT NULL DEFAULT '[]',
        channel           TEXT NOT NULL DEFAULT 'console',
        updated_at        TEXT NOT NULL
      )
    `);
  },
};
