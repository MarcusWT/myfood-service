import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationPoller } from '../notification-poller.js';
import { logger } from '../../logger.js';
import type { ExpiryAlertServicePort } from '../../core/ports/inbound/expiry-alert.service.port.js';
import type { NotificationPort } from '../../core/ports/outbound/notification.port.js';
import type { UserRepositoryPort } from '../../core/ports/outbound/user-repository.port.js';
import type { ExpiryAlert } from '../../core/domain/expiry-alert.js';
import type { User } from '../../core/domain/user.js';
import { InMemoryNotificationLogRepository } from '../../adapters/outbound/persistence/notification-log.in-memory.repository.js';

const mk = (id: string, status: ExpiryAlert['status'] = 'CRITICAL'): ExpiryAlert =>
  ({ item: { id }, daysUntilExpiry: 1, status }) as unknown as ExpiryAlert;

describe('NotificationPoller', () => {
  let expiryAlertService: ExpiryAlertServicePort;
  let notificationPort: NotificationPort;
  let userRepository: UserRepositoryPort;
  let log: InMemoryNotificationLogRepository;
  const alerts: ExpiryAlert[] = [];
  const user: User = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    log = new InMemoryNotificationLogRepository();
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
        log,
        1000,
        5,
      );

      await poller.poll();

      expect(expiryAlertService.getAlerts).toHaveBeenCalledWith(user.id, 5);
      expect(notificationPort.notify).not.toHaveBeenCalled();
    });

    it('forwards alerts to the notification port when present', async () => {
      const nonEmptyAlerts = [mk('a')];
      (expiryAlertService.getAlerts as ReturnType<typeof vi.fn>).mockResolvedValue(
        nonEmptyAlerts,
      );
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        log,
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
        log,
        1000,
      );

      await expect(poller.poll()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
      expect(notificationPort.notify).not.toHaveBeenCalled();
    });

    it('isolates per-user failures: one user throwing does not stop other users from being checked', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);
      const user2: User = {
        id: 'user-2',
        email: 'test2@example.com',
        passwordHash: 'hash',
        createdAt: new Date(),
      };
      (userRepository.listAll as ReturnType<typeof vi.fn>).mockResolvedValue([user, user2]);
      const user2Alerts = [mk('b')];
      (expiryAlertService.getAlerts as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('boom for user 1'))
        .mockResolvedValueOnce(user2Alerts);

      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        log,
        1000,
        5,
      );

      await poller.poll();

      expect(expiryAlertService.getAlerts).toHaveBeenCalledWith(user.id, 5);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledWith(user2.id, 5);
      expect(notificationPort.notify).toHaveBeenCalledWith(user2Alerts);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('logs and swallows errors from the notification port', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);
      (expiryAlertService.getAlerts as ReturnType<typeof vi.fn>).mockResolvedValue([mk('a')]);
      (notificationPort.notify as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        log,
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
        log,
        1000,
      );

      poller.start();
      expect(expiryAlertService.getAlerts).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(3);

      await poller.stop();
    });

    it('does not schedule a second interval if start is called twice', async () => {
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        log,
        1000,
      );

      poller.start();
      poller.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);

      await poller.stop();
    });

    it('stops polling after stop is called', async () => {
      const poller = new NotificationPoller(
        expiryAlertService,
        notificationPort,
        userRepository,
        log,
        1000,
      );

      poller.start();
      await vi.advanceTimersByTimeAsync(1000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);

      await poller.stop();
      await vi.advanceTimersByTimeAsync(5000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);
    });
  });

  describe('dedupe and scheduling', () => {
    const mkPoller = (now?: () => Date) =>
      new NotificationPoller(expiryAlertService, notificationPort, userRepository, log, 1000, 5, now);
    const setAlerts = (a: ExpiryAlert[]) =>
      (expiryAlertService.getAlerts as ReturnType<typeof vi.fn>).mockResolvedValue(a);

    it('does not re-notify the same alert on the same day', async () => {
      setAlerts([mk('a')]);
      const poller = mkPoller();
      await poller.poll();
      await poller.poll();
      expect(notificationPort.notify).toHaveBeenCalledTimes(1);
    });

    it('re-notifies when status changes', async () => {
      const poller = mkPoller();
      setAlerts([mk('a', 'WARNING')]);
      await poller.poll();
      setAlerts([mk('a', 'CRITICAL')]);
      await poller.poll();
      expect(notificationPort.notify).toHaveBeenCalledTimes(2);
    });

    it('re-notifies the next UTC day', async () => {
      setAlerts([mk('a')]);
      let now = new Date('2026-01-01T10:00:00Z');
      const poller = mkPoller(() => now);
      await poller.poll();
      now = new Date('2026-01-02T00:00:01Z');
      await poller.poll();
      expect(notificationPort.notify).toHaveBeenCalledTimes(2);
    });

    it('does not mark as sent when notify fails', async () => {
      vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);
      setAlerts([mk('a')]);
      (notificationPort.notify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('x'));
      const poller = mkPoller();
      await poller.poll();
      await poller.poll();
      expect(notificationPort.notify).toHaveBeenCalledTimes(2);
    });

    it('forwards only unsent alerts from a mixed list', async () => {
      const poller = mkPoller();
      setAlerts([mk('a')]);
      await poller.poll();
      setAlerts([mk('a'), mk('b')]);
      await poller.poll();
      expect(notificationPort.notify).toHaveBeenLastCalledWith([expect.objectContaining({ item: { id: 'b' } })]);
    });

    it('prunes old log entries', async () => {
      const spy = vi.spyOn(log, 'pruneBefore');
      await mkPoller(() => new Date('2026-03-31T00:00:00Z')).poll();
      expect(spy).toHaveBeenCalledWith('2026-03-01');
    });

    it('does not overlap polls and stop awaits the in-flight poll', async () => {
      let release!: () => void;
      (userRepository.listAll as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((r) => { release = () => r([user]); }),
      );
      const poller = mkPoller();
      poller.start();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(5000);
      expect(userRepository.listAll).toHaveBeenCalledTimes(1);

      let stopped = false;
      const stopP = poller.stop().then(() => { stopped = true; });
      await vi.advanceTimersByTimeAsync(0);
      expect(stopped).toBe(false);
      release();
      await stopP;
      expect(stopped).toBe(true);
      await vi.advanceTimersByTimeAsync(5000);
      expect(userRepository.listAll).toHaveBeenCalledTimes(1);
    });

    it('restart during an in-flight poll yields a single non-overlapping chain', async () => {
      const releases: Array<() => void> = [];
      let active = 0;
      let maxActive = 0;
      (userRepository.listAll as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((r) => releases.push(r));
        active--;
        return [user];
      });
      const poller = mkPoller();
      poller.start();
      await vi.advanceTimersByTimeAsync(1000);
      expect(userRepository.listAll).toHaveBeenCalledTimes(1);

      const stopP = poller.stop();
      poller.start();
      releases.shift()!();
      await stopP;
      await vi.advanceTimersByTimeAsync(0);

      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(userRepository.listAll).toHaveBeenCalledTimes(2);
      releases.shift()!();
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(1);
      expect(maxActive).toBe(1);
      await poller.stop();
    });

    it('does not call markSent when notify throws', async () => {
      vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);
      const spy = vi.spyOn(log, 'markSent');
      setAlerts([mk('a')]);
      (notificationPort.notify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('x'));
      await mkPoller().poll();
      expect(spy).not.toHaveBeenCalled();
    });

    it('survives markSent throwing', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined as never);
      vi.spyOn(log, 'markSent').mockRejectedValueOnce(new Error('db'));
      setAlerts([mk('a')]);
      const poller = mkPoller();
      await expect(poller.poll()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
      await poller.poll();
      expect(notificationPort.notify).toHaveBeenCalledTimes(2);
    });
  });
});
