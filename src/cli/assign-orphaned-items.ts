import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';
import { assignOrphanedFoodItems } from '../adapters/outbound/persistence/assign-orphaned-items.js';
import { runMigrations } from '../adapters/outbound/persistence/migrations/migration-runner.js';
import { allMigrations } from '../adapters/outbound/persistence/migrations/index.js';

const USAGE = 'Usage: assign-orphaned-items --email <user email> [--dry-run]';

/**
 * One-shot CLI. Intentionally uses console.log (not the pino logger) and does
 * not import config.js, so it needs no JWT_SECRET. Returns the exit code.
 */
export function main(argv: string[], env: NodeJS.ProcessEnv = process.env): number {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        email: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
      },
      strict: true,
    });
    if (!values.email) throw new Error(`--email is required. ${USAGE}`);

    const dbPath = env.DB_PATH || path.resolve(process.cwd(), 'data/myfood.db');
    if (dbPath === ':memory:') {
      throw new Error('DB_PATH=:memory: has no persistent data to fix.');
    }

    const db = new Database(dbPath, { fileMustExist: true });
    try {
      runMigrations(db, allMigrations);
      const dryRun = values['dry-run'] === true;
      const result = assignOrphanedFoodItems(db, { email: values.email, dryRun });
      console.log(
        `${dryRun ? '[dry-run] Would assign' : 'Assigned'} ${result.count} orphaned item(s) ` +
          `to user ${result.userId} (${result.discardedDuplicates} duplicate(s) soft-discarded).`,
      );
    } finally {
      db.close();
    }
    return 0;
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
