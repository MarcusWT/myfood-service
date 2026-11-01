import { ExpiryAlert } from '../../domain/expiry-alert.js';

export interface NotificationRecipient {
  userId: string;
  email: string;
}

export interface NotificationPort {
  /**
   * Delivers the given expiry alerts for one recipient through whatever
   * channel the adapter implements (console, webhook, email, push, etc.).
   * Implementations should no-op gracefully when the list is empty. Delivery
   * is at-least-once: throw on failure so the caller does not mark the batch
   * as sent and retries on the next poll. Adapters must not retry internally.
   */
  notify(recipient: NotificationRecipient, alerts: ExpiryAlert[]): Promise<void>;
}
