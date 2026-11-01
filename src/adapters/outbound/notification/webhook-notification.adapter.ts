import { createHmac } from 'node:crypto';
import { ExpiryAlert } from '../../../core/domain/expiry-alert.js';
import {
  NotificationPort,
  NotificationRecipient,
} from '../../../core/ports/outbound/notification.port.js';
import { logger } from '../../../logger.js';

export interface WebhookNotificationOptions {
  url: string;
  secret?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/**
 * POSTs expiry alerts as JSON to an operator-configured URL, optionally signed
 * with HMAC-SHA256 (`X-MyFood-Signature: sha256=<hex of "${timestamp}.${body}">`).
 * Never logs the URL, secret, headers or body. No retries: failures throw so
 * the poller retries on its next run (at-least-once delivery).
 *
 * SSRF note: the URL is operator-set; DNS/IP blocking is a non-goal until
 * per-user URLs exist.
 */
export class WebhookNotificationAdapter implements NotificationPort {
  private readonly url: string;
  private readonly secret?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WebhookNotificationOptions) {
    this.url = options.url;
    this.secret = options.secret || undefined;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async notify(recipient: NotificationRecipient, alerts: ExpiryAlert[]): Promise<void> {
    if (alerts.length === 0) return;

    const sentAt = new Date().toISOString();
    const body = JSON.stringify({
      event: 'expiry_alerts',
      sentAt,
      user: { id: recipient.userId, email: recipient.email },
      alerts: alerts.map((a) => ({
        status: a.status,
        daysUntilExpiry: a.daysUntilExpiry,
        item: {
          id: a.item.id,
          name: a.item.name,
          location: a.item.location,
          category: a.item.category,
          bestBefore: a.item.bestBefore.toISOString(),
          quantity: a.item.quantity,
          unit: a.item.unit,
          ...(a.item.notes !== undefined ? { notes: a.item.notes } : {}),
        },
      })),
    });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.secret) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac('sha256', this.secret).update(`${timestamp}.${body}`).digest('hex');
      headers['X-MyFood-Timestamp'] = timestamp;
      headers['X-MyFood-Signature'] = `sha256=${signature}`;
    }

    let status: number;
    try {
      const res = await this.fetchImpl(this.url, {
        method: 'POST',
        headers,
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      status = res.status;
      await res.body?.cancel?.().catch(() => undefined);
    } catch (err) {
      // fetch errors may embed the URL, so only a fixed message is surfaced.
      logger.warn(
        { channel: 'webhook', userId: recipient.userId, errName: (err as Error)?.name },
        '[Notification] Webhook request failed',
      );
      // Deliberately no `cause`: fetch errors may embed the request URL.
      // eslint-disable-next-line preserve-caught-error
      throw new Error('Webhook request failed');
    }

    if (status < 200 || status > 299) {
      logger.warn({ channel: 'webhook', userId: recipient.userId, status }, '[Notification] Webhook rejected');
      throw new Error(`Webhook responded ${status}`);
    }
  }
}
