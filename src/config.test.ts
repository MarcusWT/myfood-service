import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

vi.mock('dotenv/config', () => ({}));

const NUMERIC_VARS = [
  'PORT',
  'DB_PATH',
  'EXPIRY_ALERT_DEFAULT_DAYS',
  'NOTIFICATION_POLL_INTERVAL_MS',
  'NOTIFICATION_WITHIN_DAYS',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX',
  'AUTH_RATE_LIMIT_MAX',
  'RECIPE_RATE_LIMIT_MAX',
  'TRUST_PROXY',
];

let saved: NodeJS.ProcessEnv;
let warn: ReturnType<typeof vi.spyOn>;

async function load() {
  vi.resetModules();
  return (await import('./config.js')).config;
}

beforeEach(() => {
  saved = { ...process.env };
  for (const v of NUMERIC_VARS) delete process.env[v];
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  process.env = saved;
  warn.mockRestore();
});

describe('config', () => {
  it('uses defaults', async () => {
    const c = await load();
    expect(c.port).toBe(3000);
    expect(c.expiryAlertDefaultDays).toBe(7);
    expect(c.notificationPollIntervalMs).toBe(3_600_000);
    expect(c.notificationWithinDays).toBe(7);
    expect(c.rateLimitWindowMs).toBe(900_000);
    expect(c.rateLimitMax).toBe(200);
    expect(c.authRateLimitMax).toBe(10);
    expect(c.recipeRateLimitMax).toBe(20);
    expect(c.trustProxy).toBe(false);
  });

  it('defaults DB_PATH relative to cwd and honours override', async () => {
    expect((await load()).dbPath).toBe(path.resolve(process.cwd(), 'data', 'myfood.db'));
    process.env.DB_PATH = ':memory:';
    expect((await load()).dbPath).toBe(':memory:');
  });

  it.each(['abc', 'NaN', 'Infinity', '-1', '70000', '3.5'])('rejects PORT=%s', async (v) => {
    process.env.PORT = v;
    await expect(load()).rejects.toThrow(/PORT/);
  });

  it('treats empty PORT as default', async () => {
    process.env.PORT = '';
    expect((await load()).port).toBe(3000);
  });

  it.each(['abc', '0', '999', '1e12'])('rejects poll interval %s', async (v) => {
    process.env.NOTIFICATION_POLL_INTERVAL_MS = v;
    await expect(load()).rejects.toThrow(/NOTIFICATION_POLL_INTERVAL_MS/);
  });

  it('accepts poll interval 5000', async () => {
    process.env.NOTIFICATION_POLL_INTERVAL_MS = '5000';
    expect((await load()).notificationPollIntervalMs).toBe(5000);
  });

  it.each([
    ['EXPIRY_ALERT_DEFAULT_DAYS', '-1'],
    ['EXPIRY_ALERT_DEFAULT_DAYS', '3651'],
    ['NOTIFICATION_WITHIN_DAYS', 'abc'],
    ['NOTIFICATION_WITHIN_DAYS', '4000'],
    ['RATE_LIMIT_WINDOW_MS', '0'],
    ['RATE_LIMIT_WINDOW_MS', '2147483648'],
    ['RATE_LIMIT_MAX', '0'],
    ['AUTH_RATE_LIMIT_MAX', 'x'],
    ['RECIPE_RATE_LIMIT_MAX', '1.5'],
  ])('rejects %s=%s', async (name, value) => {
    process.env[name] = value;
    await expect(load()).rejects.toThrow(new RegExp(name));
  });

  it('NOTIFICATION_WITHIN_DAYS falls back to EXPIRY_ALERT_DEFAULT_DAYS', async () => {
    process.env.EXPIRY_ALERT_DEFAULT_DAYS = '14';
    expect((await load()).notificationWithinDays).toBe(14);
    process.env.NOTIFICATION_WITHIN_DAYS = '3';
    expect((await load()).notificationWithinDays).toBe(3);
  });

  it.each([
    ['true', true],
    ['false', false],
    ['1', 1],
    ['2', 2],
  ])('TRUST_PROXY=%s', async (v, expected) => {
    process.env.TRUST_PROXY = v;
    expect((await load()).trustProxy).toBe(expected);
  });

  it.each(['-1', 'Infinity', 'banana'])('TRUST_PROXY=%s warns and defaults to false', async (v) => {
    process.env.TRUST_PROXY = v;
    expect((await load()).trustProxy).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('TRUST_PROXY'));
  });

  describe('Spoonacular / recipe cache vars', () => {
    const VARS = [
      'SPOONACULAR_TIMEOUT_MS',
      'SPOONACULAR_ENRICHMENT_TIMEOUT_MS',
      'RECIPE_CACHE_TTL_MS',
      'RECIPE_CACHE_MAX_ENTRIES',
    ];
    beforeEach(() => {
      for (const v of VARS) delete process.env[v];
    });

    it('uses defaults', async () => {
      const c = await load();
      expect(c.spoonacularTimeoutMs).toBe(8000);
      expect(c.spoonacularEnrichmentTimeoutMs).toBe(5000);
      expect(c.recipeCacheTtlMs).toBe(600_000);
      expect(c.recipeCacheMaxEntries).toBe(500);
    });

    it('accepts overrides', async () => {
      process.env.SPOONACULAR_TIMEOUT_MS = '1234';
      process.env.SPOONACULAR_ENRICHMENT_TIMEOUT_MS = '2345';
      process.env.RECIPE_CACHE_TTL_MS = '3456';
      process.env.RECIPE_CACHE_MAX_ENTRIES = '7';
      const c = await load();
      expect(c.spoonacularTimeoutMs).toBe(1234);
      expect(c.spoonacularEnrichmentTimeoutMs).toBe(2345);
      expect(c.recipeCacheTtlMs).toBe(3456);
      expect(c.recipeCacheMaxEntries).toBe(7);
    });

    it.each(VARS.flatMap((v) => ['abc', '0', '-5', '1.5'].map((x) => [v, x])))(
      'rejects %s=%s',
      async (name, value) => {
        process.env[name] = value;
        await expect(load()).rejects.toThrow(name);
      },
    );
  });
});
