import { NotificationPort } from '../../../core/ports/outbound/notification.port.js';
import { NotificationLogPort } from '../../../core/ports/outbound/notification-log.port.js';
import { ConsoleNotificationAdapter } from './console-notification.adapter.js';
import { WebhookNotificationAdapter } from './webhook-notification.adapter.js';
import { CompositeNotificationAdapter } from './composite-notification.adapter.js';

export interface NotificationAdapterConfig {
  notificationChannels: readonly string[];
  notificationWebhookUrl: string;
  notificationWebhookSecret: string;
  notificationWebhookTimeoutMs: number;
}

export function createNotificationAdapter(
  cfg: NotificationAdapterConfig,
  fetchImpl?: typeof fetch,
  log?: NotificationLogPort,
): NotificationPort {
  const names = cfg.notificationChannels.length > 0 ? cfg.notificationChannels : ['console'];
  const channels = [...new Set(names)].map((name) => {
    switch (name) {
      case 'console':
        return { name, port: new ConsoleNotificationAdapter() as NotificationPort };
      case 'webhook':
        if (!cfg.notificationWebhookUrl) {
          throw new Error('[Config] NOTIFICATION_WEBHOOK_URL is required when the webhook channel is enabled.');
        }
        return {
          name,
          port: new WebhookNotificationAdapter({
            url: cfg.notificationWebhookUrl,
            secret: cfg.notificationWebhookSecret || undefined,
            timeoutMs: cfg.notificationWebhookTimeoutMs,
            fetchImpl,
          }) as NotificationPort,
        };
      default:
        throw new Error(`[Config] Unknown notification channel '${name}'.`);
    }
  });
  return channels.length === 1 ? channels[0].port : new CompositeNotificationAdapter(channels, log);
}
