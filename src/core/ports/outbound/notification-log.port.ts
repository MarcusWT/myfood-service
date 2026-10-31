import { ExpiryAlert } from '../../domain/expiry-alert.js';

/**
 * Records which expiry alerts were already notified so the poller does not
 * repeat sends. Dedupe key: (userId, itemId, status, day) where `day` is a
 * UTC calendar day string (YYYY-MM-DD).
 */
export interface NotificationLogPort {
  filterUnsent(userId: string, alerts: ExpiryAlert[], day: string): Promise<ExpiryAlert[]>;
  markSent(userId: string, alerts: ExpiryAlert[], day: string): Promise<void>;
  /** Deletes entries with day strictly before `day`; returns number removed. */
  pruneBefore(day: string): Promise<number>;
}
