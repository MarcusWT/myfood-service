import type { Migration } from './migration-runner.js';

export const createUsersMigration: Migration = {
  id: 4,
  name: 'create-users',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL
      )
    `);
  },
};
