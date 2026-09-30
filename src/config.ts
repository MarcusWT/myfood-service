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
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 200),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
  recipeRateLimitMax: Number(process.env.RECIPE_RATE_LIMIT_MAX ?? 20),
  bodyLimit: process.env.BODY_LIMIT ?? '100kb',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
} as const;

function parseTrustProxy(value: string | undefined): boolean | number {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return numeric;
  // Unparseable, non-empty value (e.g. a typo) — warn rather than silently
  // falling back to `false`, since a misconfigured TRUST_PROXY behind a real
  // reverse proxy would make express-rate-limit key on the proxy's IP for
  // every client without any visible indication something is wrong.
  console.warn(
    `[Config] TRUST_PROXY value '${value}' is not a recognized boolean/number; defaulting to false.`,
  );
  return false;
}

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

if (config.jwtSecret === 'change_me_to_a_long_random_secret' && config.nodeEnv !== 'test') {
  throw new Error(
    '[Config] JWT_SECRET is still set to the .env.example placeholder value. ' +
      'Refusing to start outside the test environment because this placeholder is ' +
      'publicly known and would allow anyone to forge authentication tokens. ' +
      'Set JWT_SECRET to a real, random secret.',
  );
}

if (config.corsOrigin === '*' && config.nodeEnv !== 'test') {
  console.warn(
    '[Config] CORS_ORIGIN is not set; defaulting to "*" (allow any origin). ' +
      'This is fine for local development but should be set to an explicit, ' +
      'comma-separated allow-list of origins in any shared/production environment.',
  );
}
