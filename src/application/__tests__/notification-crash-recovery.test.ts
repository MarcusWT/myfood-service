import { describe, it, expect, vi } from 'vitest';
import { NotificationPoller } from '../notification-poller.js';
import { CompositeNotificationAdapter } from '../../adapters/outbound/notification/composite-notification.adapter.js';
import { InMemoryNotificationLogRepository } from '../../adapters/outbound/persistence/notification-log.in-memory.repository.js';
import type { ExpiryAlert } from '../../core/domain/expiry-alert.js';
import type { NotificationPort } from '../../core/ports/outbound/notification.port.js';
import type { UserRepositoryPort } from '../../core/ports/outbound/user-repository.port.js';

describe('crash between channel marks and poller mark', () => {
  it("re-notifies, composite sends nothing, then the poller marks ''", async () => {
    const now = new Date('2026-11-01T10:00:00.000Z');
    const day = '2026-11-01';
    const alerts = [{ item: { id: 'i1' }, daysUntilExpiry: 1, status: 'CRITICAL' }] as unknown as ExpiryAlert[];
    const user = { id: 'u1', email: 'u@x.test', passwordHash: 'h', createdAt: now };
    const log = new InMemoryNotificationLogRepository();
    await log.markSent(user.id, alerts, day, 'console');
    await log.markSent(user.id, alerts, day, 'webhook');

    const consolePort: NotificationPort = { notify: vi.fn().mockResolvedValue(undefined) };
    const webhookPort: NotificationPort = { notify: vi.fn().mockResolvedValue(undefined) };
    const composite = new CompositeNotificationAdapter(
      [
        { name: 'console', port: consolePort },
        { name: 'webhook', port: webhookPort },
      ],
      log,
      () => now,
    );
    const notify = vi.spyOn(composite, 'notify');
    const users = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      listAll: vi.fn().mockResolvedValue([user]),
    } as unknown as UserRepositoryPort;
    const alertService = { getAlerts: vi.fn().mockResolvedValue(alerts) };
    const poller = new NotificationPoller(alertService, composite, users, log, 1000, 5, () => now);

    expect(await log.filterUnsent(user.id, alerts, day)).toHaveLength(1);
    await poller.poll();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(consolePort.notify).not.toHaveBeenCalled();
    expect(webhookPort.notify).not.toHaveBeenCalled();
    expect(await log.filterUnsent(user.id, alerts, day)).toHaveLength(0);
  });
});
