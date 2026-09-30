import { ExpiryAlert } from '../../../core/domain/expiry-alert.js';
import { NotificationPort } from '../../../core/ports/outbound/notification.port.js';
import { logger } from '../../../logger.js';

/**
 * Starting-point notification adapter: logs alerts to stdout. A future
 * adapter (email/push/webhook) can implement the same NotificationPort
 * without any changes to the application layer.
 */
export class ConsoleNotificationAdapter implements NotificationPort {
  async notify(alerts: ExpiryAlert[]): Promise<void> {
    if (alerts.length === 0) return;

    for (const alert of alerts) {
      logger.info(
        { status: alert.status, item: alert.item.name, daysUntilExpiry: alert.daysUntilExpiry },
        `[Alert] ${alert.status}: "${alert.item.name}" — ${alert.daysUntilExpiry} day(s) until expiry`,
      );
    }
  }
}
