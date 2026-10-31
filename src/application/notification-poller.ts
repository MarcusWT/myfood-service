import { ExpiryAlertServicePort } from '../core/ports/inbound/expiry-alert.service.port.js';
import { NotificationPort } from '../core/ports/outbound/notification.port.js';
import { NotificationLogPort } from '../core/ports/outbound/notification-log.port.js';
import { UserRepositoryPort } from '../core/ports/outbound/user-repository.port.js';
import { logger } from '../logger.js';

const RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Periodically polls for expiring items (per registered user) and forwards
 * not-yet-sent alerts to a NotificationPort. Polls never overlap (chained
 * timeouts + in-flight guard). Delivery is at-least-once, deduped per UTC day:
 * notify runs first, then markSent in the NotificationLogPort, so a failure
 * between the two may re-notify on the next poll. Errors during a poll
 * are caught and logged so a failed run never stops the poller.
 */
export class NotificationPoller {
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;
  private running = false;

  constructor(
    private readonly expiryAlertService: ExpiryAlertServicePort,
    private readonly notificationPort: NotificationPort,
    private readonly userRepository: UserRepositoryPort,
    private readonly notificationLog: NotificationLogPort,
    private readonly intervalMs: number,
    private readonly withinDays?: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    // If a poll is still in flight, its completion will schedule the next run.
    this.schedule();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.inFlight) {
      await this.inFlight;
    }
  }

  private schedule(): void {
    if (!this.running || this.timer || this.inFlight) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.poll().finally(() => this.schedule());
    }, this.intervalMs);
    this.timer.unref?.();
  }

  async poll(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const run = this.runPoll().finally(() => {
      if (this.inFlight === run) this.inFlight = undefined;
    });
    this.inFlight = run;
    return run;
  }

  private async runPoll(): Promise<void> {
    try {
      const nowDate = this.now();
      const day = nowDate.toISOString().slice(0, 10);
      const users = await this.userRepository.listAll();
      for (const user of users) {
        try {
          const alerts = await this.expiryAlertService.getAlerts(user.id, this.withinDays);
          const unsent = await this.notificationLog.filterUnsent(user.id, alerts, day);
          if (unsent.length > 0) {
            await this.notificationPort.notify(unsent);
            await this.notificationLog.markSent(user.id, unsent, day);
          }
        } catch (err) {
          logger.error(
            { err, userId: user.id },
            '[NotificationPoller] Failed to check expiry alerts for user; continuing with remaining users',
          );
        }
      }
      try {
        const cutoff = new Date(nowDate.getTime() - RETENTION_DAYS * MS_PER_DAY)
          .toISOString()
          .slice(0, 10);
        await this.notificationLog.pruneBefore(cutoff);
      } catch (err) {
        logger.error({ err }, '[NotificationPoller] Failed to prune notification log');
      }
    } catch (err) {
      logger.error({ err }, '[NotificationPoller] Failed to poll for expiry alerts');
    }
  }
}
