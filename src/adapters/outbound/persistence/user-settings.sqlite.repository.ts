import Database from 'better-sqlite3';
import { UserSettings } from '../../../core/domain/user-settings.js';
import { UserSettingsRepositoryPort } from '../../../core/ports/outbound/user-settings.repository.port.js';
import { runMigrations, allMigrations } from './migrations/index.js';

interface Row {
  alert_within_days: number | null;
  diet: string | null;
  intolerances: string;
  channel: string;
}

function parseIntolerances(raw: string): UserSettings['intolerances'] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UserSettings['intolerances']) : [];
  } catch {
    return [];
  }
}

export class SqliteUserSettingsRepository implements UserSettingsRepositoryPort {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('journal_mode = WAL');
    runMigrations(this.db, allMigrations);
  }

  async get(userId: string): Promise<UserSettings | null> {
    const row = this.db
      .prepare('SELECT alert_within_days, diet, intolerances, channel FROM user_settings WHERE user_id = ?')
      .get(userId) as Row | undefined;
    if (!row) return null;
    return {
      alertWithinDays: row.alert_within_days,
      diet: row.diet as UserSettings['diet'],
      intolerances: parseIntolerances(row.intolerances),
      channel: row.channel as UserSettings['channel'],
    };
  }

  async upsert(userId: string, s: UserSettings): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO user_settings (user_id, alert_within_days, diet, intolerances, channel, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           alert_within_days = excluded.alert_within_days,
           diet = excluded.diet,
           intolerances = excluded.intolerances,
           channel = excluded.channel,
           updated_at = excluded.updated_at`,
      )
      .run(userId, s.alertWithinDays, s.diet, JSON.stringify(s.intolerances), s.channel, new Date().toISOString());
  }

  close(): void {
    this.db.close();
  }
}
