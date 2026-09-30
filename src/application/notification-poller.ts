import { ExpiryAlertServicePort } from '../core/ports/inbound/expiry-alert.service.port.js';
import { NotificationPort } from '../core/ports/outbound/notification.port.js';
import { UserRepositoryPort } from '../core/ports/outbound/user-repository.port.js';

/**
 * Periodically polls for expiring items (per registered user, since food
 * items are now scoped to a userId) and forwards them to a
 * NotificationPort. Errors during a poll are caught and logged so that a
 * single failed run never stops the poller or crashes the process.
 */
export class NotificationPoller {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly expiryAlertService: ExpiryAlertServicePort,
    private readonly notificationPort: NotificationPort,
    private readonly userRepository: UserRepositoryPort,
    private readonly intervalMs: number,
    private readonly withinDays?: number,
  ) {}

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.poll();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async poll(): Promise<void> {
    try {
      const users = await this.userRepository.listAll();
      for (const user of users) {
        const alerts = await this.expiryAlertService.getAlerts(user.id, this.withinDays);
        if (alerts.length > 0) {
          await this.notificationPort.notify(alerts);
        }
      }
    } catch (err) {
      console.error('[NotificationPoller] Failed to poll for expiry alerts:', err);
    }
  }
}

