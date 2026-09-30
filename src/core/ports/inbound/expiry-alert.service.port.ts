import { ExpiryAlert } from '../../domain/expiry-alert.js';

export interface ExpiryAlertServicePort {
  /**
   * Returns all items expiring within the given number of days (default 7),
   * including already-expired items.
   */
  getAlerts(userId: string, withinDays?: number): Promise<ExpiryAlert[]>;
}
