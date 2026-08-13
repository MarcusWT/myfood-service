import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationPoller } from '../notification-poller.js';
import type { ExpiryAlertServicePort } from '../../core/ports/inbound/expiry-alert.service.port.js';
import type { NotificationPort } from '../../core/ports/outbound/notification.port.js';
import type { ExpiryAlert } from '../../core/domain/expiry-alert.js';

describe('NotificationPoller', () => {
  let expiryAlertService: ExpiryAlertServicePort;
  let notificationPort: NotificationPort;
  const alerts: ExpiryAlert[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    expiryAlertService = { getAlerts: vi.fn().mockResolvedValue(alerts) };
    notificationPort = { notify: vi.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('poll', () => {
    it('fetches alerts and forwards them to the notification port', async () => {
      const poller = new NotificationPoller(expiryAlertService, notificationPort, 1000, 5);

      await poller.poll();

      expect(expiryAlertService.getAlerts).toHaveBeenCalledWith(5);
      expect(notificationPort.notify).toHaveBeenCalledWith(alerts);
    });

    it('logs and swallows errors from the expiry alert service', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      (expiryAlertService.getAlerts as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('boom'),
      );
      const poller = new NotificationPoller(expiryAlertService, notificationPort, 1000);

      await expect(poller.poll()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
      expect(notificationPort.notify).not.toHaveBeenCalled();
    });

    it('logs and swallows errors from the notification port', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      (notificationPort.notify as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      const poller = new NotificationPoller(expiryAlertService, notificationPort, 1000);

      await expect(poller.poll()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('start / stop', () => {
    it('polls repeatedly at the configured interval', async () => {
      const poller = new NotificationPoller(expiryAlertService, notificationPort, 1000);

      poller.start();
      expect(expiryAlertService.getAlerts).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(3);

      poller.stop();
    });

    it('does not schedule a second interval if start is called twice', async () => {
      const poller = new NotificationPoller(expiryAlertService, notificationPort, 1000);

      poller.start();
      poller.start();

      await vi.advanceTimersByTimeAsync(1000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);

      poller.stop();
    });

    it('stops polling after stop is called', async () => {
      const poller = new NotificationPoller(expiryAlertService, notificationPort, 1000);

      poller.start();
      await vi.advanceTimersByTimeAsync(1000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);

      poller.stop();
      await vi.advanceTimersByTimeAsync(5000);
      expect(expiryAlertService.getAlerts).toHaveBeenCalledTimes(1);
    });
  });
});
