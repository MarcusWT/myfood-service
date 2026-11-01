import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { WebhookNotificationAdapter } from '../webhook-notification.adapter.js';
import { CompositeNotificationAdapter } from '../composite-notification.adapter.js';
import { createNotificationAdapter } from '../create-notification-adapter.js';
import { ConsoleNotificationAdapter } from '../console-notification.adapter.js';
import { InMemoryNotificationLogRepository } from '../../persistence/notification-log.in-memory.repository.js';
import type { ExpiryAlert } from '../../../../core/domain/expiry-alert.js';
import type { NotificationPort } from '../../../../core/ports/outbound/notification.port.js';

const URL_ = 'https://hooks.example.com/secret-path-token';
const recipient = { userId: 'u1', email: 'u@example.com' };
const alerts = [
  {
    status: 'CRITICAL',
    daysUntilExpiry: 1,
    item: {
      id: 'i1',
      userId: 'u1',
      name: 'Milk',
      location: 'FRIDGE',
      category: 'DAIRY',
      quantity: 1,
      unit: 'LITRES',
      bestBefore: new Date('2026-09-01T00:00:00Z'),
    },
  },
] as unknown as ExpiryAlert[];

const okFetch = () => vi.fn(async () => new Response(null, { status: 204 }));
const call = (f: ReturnType<typeof vi.fn>) => f.mock.calls[0] as unknown as [string, RequestInit];

describe('WebhookNotificationAdapter', () => {
  it('posts the JSON payload with explicit item mapping', async () => {
    const f = okFetch();
    await new WebhookNotificationAdapter({ url: URL_, timeoutMs: 1000, fetchImpl: f as never }).notify(
      recipient,
      alerts,
    );
    const [url, init] = call(f);
    expect(url).toBe(URL_);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.redirect).toBe('error');
    const body = JSON.parse(init.body as string);
    expect(body.event).toBe('expiry_alerts');
    expect(body.user).toEqual({ id: 'u1', email: 'u@example.com' });
    expect(body.alerts[0]).toMatchObject({
      status: 'CRITICAL',
      daysUntilExpiry: 1,
      item: { id: 'i1', name: 'Milk', location: 'FRIDGE', bestBefore: '2026-09-01T00:00:00.000Z', quantity: 1 },
    });
    expect(body.alerts[0].item.userId).toBeUndefined();
  });

  it('signs with HMAC-SHA256 over `${timestamp}.${body}` when a secret is set', async () => {
    const f = okFetch();
    await new WebhookNotificationAdapter({ url: URL_, secret: 's3cret', timeoutMs: 1000, fetchImpl: f as never }).notify(
      recipient,
      alerts,
    );
    const [, init] = call(f);
    const h = init.headers as Record<string, string>;
    const expected = createHmac('sha256', 's3cret').update(`${h['X-MyFood-Timestamp']}.${init.body}`).digest('hex');
    expect(h['X-MyFood-Signature']).toBe(`sha256=${expected}`);
  });

  it('sends no signature headers without a secret', async () => {
    const f = okFetch();
    await new WebhookNotificationAdapter({ url: URL_, timeoutMs: 1000, fetchImpl: f as never }).notify(recipient, alerts);
    const h = call(f)[1].headers as Record<string, string>;
    expect(h['X-MyFood-Signature']).toBeUndefined();
    expect(h['X-MyFood-Timestamp']).toBeUndefined();
  });

  it('rejects on non-2xx without leaking the URL or secret', async () => {
    const f = vi.fn(async () => new Response('nope', { status: 500 }));
    const a = new WebhookNotificationAdapter({ url: URL_, secret: 's3cret', timeoutMs: 1000, fetchImpl: f as never });
    const err = await a.notify(recipient, alerts).catch((e: Error) => e);
    expect((err as Error).message).toBe('Webhook responded 500');
  });

  it('rejects on network error and timeout with a fixed message', async () => {
    const f = vi.fn(async () => {
      throw new Error(`connect failed ${URL_}`);
    });
    const a = new WebhookNotificationAdapter({ url: URL_, secret: 's3cret', timeoutMs: 1000, fetchImpl: f as never });
    const err = (await a.notify(recipient, alerts).catch((e: Error) => e)) as Error;
    expect(err.message).toBe('Webhook request failed');
    expect(err.message).not.toContain(URL_);

    const slow = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init.signal!.addEventListener('abort', () => rej(init.signal!.reason));
        }),
    );
    const b = new WebhookNotificationAdapter({ url: URL_, timeoutMs: 10, fetchImpl: slow as never });
    await expect(b.notify(recipient, alerts)).rejects.toThrow('Webhook request failed');
  });

  it('does nothing for an empty list', async () => {
    const f = okFetch();
    await new WebhookNotificationAdapter({ url: URL_, timeoutMs: 1000, fetchImpl: f as never }).notify(recipient, []);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('CompositeNotificationAdapter', () => {
  const ok = (): NotificationPort => ({ notify: vi.fn().mockResolvedValue(undefined) });
  const bad = (): NotificationPort => ({ notify: vi.fn().mockRejectedValue(new Error('x')) });

  it('calls all channels and resolves when all succeed', async () => {
    const a = ok();
    const b = ok();
    await new CompositeNotificationAdapter([{ name: 'a', port: a }, { name: 'b', port: b }]).notify(recipient, alerts);
    expect(a.notify).toHaveBeenCalledWith(recipient, alerts);
    expect(b.notify).toHaveBeenCalledWith(recipient, alerts);
  });

  it('still calls the others when one fails, then throws an AggregateError', async () => {
    const b = ok();
    const c = new CompositeNotificationAdapter([{ name: 'a', port: bad() }, { name: 'b', port: b }]);
    await expect(c.notify(recipient, alerts)).rejects.toBeInstanceOf(AggregateError);
    expect(b.notify).toHaveBeenCalled();
  });
});

describe('createNotificationAdapter', () => {
  const base = {
    notificationChannels: ['console'],
    notificationWebhookUrl: '',
    notificationWebhookSecret: '',
    notificationWebhookTimeoutMs: 1000,
  };

  it('defaults to console', () => {
    expect(createNotificationAdapter(base)).toBeInstanceOf(ConsoleNotificationAdapter);
    expect(createNotificationAdapter({ ...base, notificationChannels: [] })).toBeInstanceOf(ConsoleNotificationAdapter);
  });

  it('builds a composite for several channels', () => {
    const a = createNotificationAdapter({ ...base, notificationChannels: ['console', 'webhook'], notificationWebhookUrl: URL_ });
    expect(a).toBeInstanceOf(CompositeNotificationAdapter);
  });

  it('throws for unknown channels or a missing webhook URL', () => {
    expect(() => createNotificationAdapter({ ...base, notificationChannels: ['sms'] })).toThrow(/Unknown/);
    expect(() => createNotificationAdapter({ ...base, notificationChannels: ['webhook'] })).toThrow(/WEBHOOK_URL/);
  });
});

describe('CompositeNotificationAdapter per-channel tracking', () => {
  it('does not re-notify a succeeded channel while another fails, then delivers once on recovery', async () => {
    const log = new InMemoryNotificationLogRepository();
    const consoleCh = { notify: vi.fn(async () => {}) };
    let webhookUp = false;
    const webhookCh = {
      notify: vi.fn(async () => {
        if (!webhookUp) throw new Error('down');
      }),
    };
    const c = new CompositeNotificationAdapter(
      [{ name: 'console', port: consoleCh }, { name: 'webhook', port: webhookCh }],
      log,
      () => new Date('2026-09-01T10:00:00Z'),
    );
    for (let i = 0; i < 3; i++) await expect(c.notify(recipient, alerts)).rejects.toBeInstanceOf(AggregateError);
    expect(consoleCh.notify).toHaveBeenCalledTimes(1);
    expect(webhookCh.notify).toHaveBeenCalledTimes(3);
    webhookUp = true;
    await c.notify(recipient, alerts);
    await c.notify(recipient, alerts);
    expect(consoleCh.notify).toHaveBeenCalledTimes(1);
    expect(webhookCh.notify).toHaveBeenCalledTimes(4);
  });
});
