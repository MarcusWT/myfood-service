import { ExpiryAlert } from '../../../core/domain/expiry-alert.js';
import { NotificationLogPort } from '../../../core/ports/outbound/notification-log.port.js';

export class InMemoryNotificationLogRepository implements NotificationLogPort {
  private readonly sent = new Set<string>();

  private key(userId: string, a: ExpiryAlert, day: string, channel = ''): string {
    return JSON.stringify([userId, a.item.id, a.status, day, channel]);
  }

  async filterUnsent(userId: string, alerts: ExpiryAlert[], day: string, channel = ''): Promise<ExpiryAlert[]> {
    return alerts.filter((a) => !this.sent.has(this.key(userId, a, day, channel)));
  }

  async markSent(userId: string, alerts: ExpiryAlert[], day: string, channel = ''): Promise<void> {
    for (const a of alerts) this.sent.add(this.key(userId, a, day, channel));
  }

  async pruneBefore(day: string): Promise<number> {
    let removed = 0;
    for (const k of [...this.sent]) {
      const entryDay = (JSON.parse(k) as string[])[3];
      if (entryDay < day) {
        this.sent.delete(k);
        removed++;
      }
    }
    return removed;
  }
}
