import { ExpiryAlert } from '../../domain/expiry-alert.js';

export interface NotificationPort {
  /**
   * Delivers the given expiry alerts through whatever channel the adapter
   * implements (console, email, push, webhook, etc.). Implementations should
   * no-op gracefully when the list is empty.
   */
  notify(alerts: ExpiryAlert[]): Promise<void>;
}
