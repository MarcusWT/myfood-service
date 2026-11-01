import { ExpiryAlert } from '../../../core/domain/expiry-alert.js';
import {
  NotificationPort,
  NotificationRecipient,
} from '../../../core/ports/outbound/notification.port.js';
import { NotificationLogPort } from '../../../core/ports/outbound/notification-log.port.js';
import { logger } from '../../../logger.js';

/**
 * Fans out to several channels. If any channel fails, an AggregateError is
 * thrown after all channels were attempted, so the poller does not mark the
 * batch as sent. Delivery is at-least-once: channels that succeeded will
 * receive the same batch again on the next poll (duplicates are possible) —
 * unless a NotificationLogPort is given, in which case each channel's success
 * is recorded per (alert, UTC day) and already-delivered channels are skipped
 * on retries, so only the failing channel(s) re-send.
 */
export class CompositeNotificationAdapter implements NotificationPort {
  constructor(
    private readonly channels: { name: string; port: NotificationPort }[],
    private readonly log?: NotificationLogPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async notify(recipient: NotificationRecipient, alerts: ExpiryAlert[]): Promise<void> {
    if (alerts.length === 0) return;
    const day = this.now().toISOString().slice(0, 10);
    const results = await Promise.allSettled(
      this.channels.map(async (c) => {
        const pending = this.log
          ? await this.log.filterUnsent(recipient.userId, alerts, day, c.name)
          : alerts;
        if (pending.length === 0) return;
        await c.port.notify(recipient, pending);
        await this.log?.markSent(recipient.userId, pending, day, c.name);
      }),
    );
    const errors: unknown[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const err = r.reason as Error | undefined;
        logger.error(
          { channel: this.channels[i].name, userId: recipient.userId, errName: err?.name, errMessage: err?.message },
          '[Notification] Channel failed',
        );
        errors.push(r.reason);
      }
    });
    if (errors.length > 0) {
      throw new AggregateError(errors, `${errors.length} notification channel(s) failed`);
    }
  }
}
