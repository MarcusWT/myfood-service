import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? path.join(__dirname, '..', '..', 'data', 'myfood.db'),
  spoonacularApiKey: process.env.SPOONACULAR_API_KEY ?? '',
  expiryAlertDefaultDays: Number(process.env.EXPIRY_ALERT_DEFAULT_DAYS ?? 7),
  notificationPollIntervalMs: Number(process.env.NOTIFICATION_POLL_INTERVAL_MS ?? 3_600_000),
  notificationWithinDays: Number(
    process.env.NOTIFICATION_WITHIN_DAYS ?? process.env.EXPIRY_ALERT_DEFAULT_DAYS ?? 7,
  ),
} as const;

if (!config.spoonacularApiKey) {
  console.warn(
    '[Config] SPOONACULAR_API_KEY is not set. Recipe suggestions will fail.',
  );
}
