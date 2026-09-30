import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationPoller } from '../notification-poller.js';
import { logger } from '../../logger.js';
import type { ExpiryAlertServicePort } from '../../core/ports/inbound/expiry-alert.service.port.js';
import type { NotificationPort } from '../../core/ports/outbound/notification.port.js';
import type { UserRepositoryPort } from '../../core/ports/outbound/user-repository.port.js';
import type { ExpiryAlert } from '../../core/domain/expiry-alert.js';
import type { User } from '../../core/domain/user.js';

describe('NotificationPoller', () => {
  let expiryAlertService: ExpiryAlertServicePort;
  let notificationPort: NotificationPort;
  let userRepository: UserRepositoryPort;
  const alerts: ExpiryAlert[] = [];
  const user: User = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    expiryAlertService = { getAlerts: vi.fn().mockResolvedValue(alerts) };
    notificationPort = { notify: vi.fn().mockResolvedValue(undefined) };
    userRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      listAll: vi.fn().mockResolvedValue([user]),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('poll', () => {
    it('fetches alerts per user and forwards non-empty results to the notification port', async () => {
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        1000,
        5,
      );

      await poller.poll();

      expect(expiryAlertService.getAlerts).toHaveBeenCalledWith(user.id, 5);
      expect(notificationPort.notify).not.toHaveBeenCalled();
    });

    it('forwards alerts to the notification port when present', async () => {
      const nonEmptyAlerts = [{ daysUntilExpiry: 1 }] as unknown as ExpiryAlert[];
      (expiryAlertService.getAlerts as ReturnType<typeof vi.fn>).mockResolvedValue(
        nonEmptyAlerts,
      );
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        1000,
        5,
      );

      await poller.poll();

      expect(notificationPort.notify).toHaveBeenCalledWith(nonEmptyAlerts);
    });

    it('logs and swallows errors from the expiry alert service', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);
      (expiryAlertService.getAlerts as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('boom'),
      );
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        1000,
      );

      await expect(poller.poll()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
      expect(notificationPort.notify).not.toHaveBeenCalled();
    });

    it('logs and swallows errors from the notification port', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);
      (expiryAlertService.getAlerts as ReturnType<typeof vi.fn>).mockResolvedValue([
        { daysUntilExpiry: 1 },
      ]);
      (notificationPort.notify as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        1000,
      );

      await expect(poller.poll()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('start / stop', () => {
    it('polls repeatedly at the configured interval', async () => {
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        1000,
      );

      poller.start();
      expect(expiryAlertService.getAlerts).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(3);

      poller.stop();
    });

    it('does not schedule a second interval if start is called twice', async () => {
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        1000,
      );

      poller.start();
      poller.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);

      poller.stop();
    });

    it('stops polling after stop is called', async () => {
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        1000,
      );

      poller.start();
      await vi.advanceTimersByTimeAsync(1000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);

      poller.stop();
      await vi.advanceTimersByTimeAsync(5000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);
    });
  });
});
