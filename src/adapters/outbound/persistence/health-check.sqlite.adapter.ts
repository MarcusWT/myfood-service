import Database from 'better-sqlite3';
import { HealthCheckPort } from '../../../core/ports/outbound/health-check.port.js';

/**
 * Readiness check backed by a real SQLite connection. Runs a trivial
 * `SELECT 1` against the active connection so a stale/closed/corrupted
 * connection is caught rather than assumed healthy.
 */
export class SqliteHealthCheckAdapter implements HealthCheckPort {
  constructor(private readonly db: Database.Database) {}

  async checkReadiness(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }
}
