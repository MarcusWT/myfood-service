import type Database from 'better-sqlite3';

export interface AssignOrphanedOptions {
  email: string;
  dryRun?: boolean;
}

export interface AssignOrphanedResult {
  userId: string;
  /** Orphaned rows (user_id IS NULL) assigned, or that would be in a dry run. */
  count: number;
  /** Orphaned active rows soft-discarded because they duplicate an active item. */
  discardedDuplicates: number;
}

interface OrphanRow {
  id: string;
  lname: string;
  location: string;
  active: number;
}

/**
 * Assigns legacy `food_items` rows with `user_id IS NULL` to the user with the
 * given email. Orphaned active rows that would violate the active-unique
 * (user, lower(name), location) index are soft-discarded (never deleted), as
 * migration 006 does; the existing/earliest item is kept. Idempotent.
 */
export function assignOrphanedFoodItems(
  db: Database.Database,
  { email, dryRun = false }: AssignOrphanedOptions,
): AssignOrphanedResult {
  const user = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email) as
    | { id: string }
    | undefined;
  if (!user) {
    throw new Error(`No user found with email "${email}". Register the user first.`);
  }

  const run = db.transaction((): AssignOrphanedResult => {
    const orphans = db
      .prepare(
        `SELECT id, lower(name) AS lname, location, (disposition IS NULL) AS active
         FROM food_items WHERE user_id IS NULL ORDER BY added_at ASC, rowid ASC`,
      )
      .all() as OrphanRow[];

    const existsActive = db.prepare(
      `SELECT id FROM food_items
       WHERE user_id = ? AND disposition IS NULL AND lower(name) = ? AND location = ?`,
    );
    const seen = new Map<string, string>();
    const losers: { id: string; keeper: string }[] = [];
    for (const o of orphans) {
      if (!o.active) continue;
      const key = `${o.lname}\u0000${o.location}`;
      const owned = existsActive.get(user.id, o.lname, o.location) as { id: string } | undefined;
      const keeper = owned?.id ?? seen.get(key);
      if (keeper) losers.push({ id: o.id, keeper });
      else seen.set(key, o.id);
    }

    if (dryRun) {
      return { userId: user.id, count: orphans.length, discardedDuplicates: losers.length };
    }

    const now = new Date().toISOString();
    const discard = db.prepare(
      `UPDATE food_items
       SET disposition = 'DISCARDED', disposed_at = @now, updated_at = @now,
           notes = COALESCE(notes, '') || @suffix
       WHERE id = @id AND user_id IS NULL`,
    );
    for (const l of losers) {
      discard.run({ id: l.id, now, suffix: ` [orphan-assign: duplicate of ${l.keeper}]` });
    }
    const info = db
      .prepare('UPDATE food_items SET user_id = ?, updated_at = ? WHERE user_id IS NULL')
      .run(user.id, now);
    return { userId: user.id, count: info.changes, discardedDuplicates: losers.length };
  });

  return run.immediate();
}
