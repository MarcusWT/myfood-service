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
  jwtSecret:
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'test-secret-not-for-production' : ''),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  logLevel: process.env.LOG_LEVEL ?? 'info',
} as const;

if (!config.spoonacularApiKey) {
  // Note: logger.ts imports config.ts, so the shared logger can't be used
  // here without introducing a circular import; console.warn is intentional.
  console.warn(
    '[Config] SPOONACULAR_API_KEY is not set. Recipe suggestions will fail.',
  );
}

if (!config.jwtSecret && config.nodeEnv !== 'test') {
  throw new Error(
    '[Config] JWT_SECRET is not set. Refusing to start outside the test environment ' +
      'because an empty JWT secret would allow anyone to forge authentication tokens. ' +
      'Set JWT_SECRET in your environment (see .env.example).',
  );
}
