import { ExpiryAlert } from '../../domain/expiry-alert.js';

export interface ExpiryAlertServicePort {
  /**
   * Returns all items expiring within the window, including already-expired
   * items. Window precedence: explicit `withinDays` > the user's
   * `alertWithinDays` setting > `options.fallbackDays` > service default (7).
   */
  getAlerts(
    userId: string,
    withinDays?: number,
    options?: { fallbackDays?: number },
  ): Promise<ExpiryAlert[]>;
}
