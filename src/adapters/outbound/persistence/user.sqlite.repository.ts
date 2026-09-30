import Database from 'better-sqlite3';
import { User } from '../../../core/domain/user.js';
import { UserRepositoryPort } from '../../../core/ports/outbound/user-repository.port.js';
import { runMigrations, allMigrations } from './migrations/index.js';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at),
  };
}

export class SqliteUserRepository implements UserRepositoryPort {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    runMigrations(this.db, allMigrations);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
      .get(email) as UserRow | undefined;
    return row ? rowToUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | UserRow
      | undefined;
    return row ? rowToUser(row) : null;
  }

  async create(user: User): Promise<User> {
    this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at)
         VALUES (@id, @email, @password_hash, @created_at)`,
      )
      .run({
        id: user.id,
        email: user.email,
        password_hash: user.passwordHash,
        created_at: user.createdAt.toISOString(),
      });
    return user;
  }

  async listAll(): Promise<User[]> {
    const rows = this.db.prepare('SELECT * FROM users').all() as UserRow[];
    return rows.map(rowToUser);
  }

  close(): void {
    this.db.close();
  }
}
