import 'dotenv/config';
import path from 'path';

const MAX_TIMER_MS = 2_147_483_647;

function parseNumberEnv(
  name: string,
  raw: string | undefined,
  fallback: number,
  opts: { min: number; max?: number; integer?: boolean },
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const { min, max = Number.POSITIVE_INFINITY, integer = true } = opts;
  const value = Number(raw);
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < min || value > max) {
    const range = Number.isFinite(max) ? `between ${min} and ${max}` : `at least ${min}`;
    throw new Error(
      `[Config] ${name} must be ${integer ? 'an integer' : 'a number'} ${range}; got '${raw}'.`,
    );
  }
  return value;
}

const expiryAlertDefaultDays = parseNumberEnv(
  'EXPIRY_ALERT_DEFAULT_DAYS',
  process.env.EXPIRY_ALERT_DEFAULT_DAYS,
  7,
  { min: 0, max: 3650 },
);

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumberEnv('PORT', process.env.PORT, 3000, { min: 0, max: 65535 }),
  dbPath: process.env.DB_PATH ?? path.resolve(process.cwd(), 'data', 'myfood.db'),
  spoonacularApiKey: process.env.SPOONACULAR_API_KEY ?? '',
  expiryAlertDefaultDays: expiryAlertDefaultDays,
  notificationPollIntervalMs: parseNumberEnv(
    'NOTIFICATION_POLL_INTERVAL_MS',
    process.env.NOTIFICATION_POLL_INTERVAL_MS,
    3_600_000,
    { min: 1000, max: MAX_TIMER_MS },
  ),
  notificationWithinDays: parseNumberEnv(
    'NOTIFICATION_WITHIN_DAYS',
    process.env.NOTIFICATION_WITHIN_DAYS,
    expiryAlertDefaultDays,
    { min: 0, max: 3650 },
  ),
  jwtSecret:
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'test-secret-not-for-production' : ''),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  rateLimitWindowMs: parseNumberEnv('RATE_LIMIT_WINDOW_MS', process.env.RATE_LIMIT_WINDOW_MS, 900_000, {
    min: 1,
    max: MAX_TIMER_MS,
  }),
  rateLimitMax: parseNumberEnv('RATE_LIMIT_MAX', process.env.RATE_LIMIT_MAX, 200, { min: 1 }),
  authRateLimitMax: parseNumberEnv('AUTH_RATE_LIMIT_MAX', process.env.AUTH_RATE_LIMIT_MAX, 10, { min: 1 }),
  recipeRateLimitMax: parseNumberEnv('RECIPE_RATE_LIMIT_MAX', process.env.RECIPE_RATE_LIMIT_MAX, 20, { min: 1 }),
  bodyLimit: process.env.BODY_LIMIT ?? '100kb',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
} as const;

function parseTrustProxy(value: string | undefined): boolean | number {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  const numeric = Number(value);
  if (value.trim() !== '' && Number.isFinite(numeric) && numeric >= 0) return numeric;
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
