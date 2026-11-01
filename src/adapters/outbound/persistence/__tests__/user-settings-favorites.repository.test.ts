import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { UserSettings } from '../../../../core/domain/user-settings.js';
import type { UserSettingsRepositoryPort } from '../../../../core/ports/outbound/user-settings.repository.port.js';
import type { FavoriteRecipeRepositoryPort } from '../../../../core/ports/outbound/favorite-recipe.repository.port.js';
import { InMemoryUserSettingsRepository } from '../user-settings.in-memory.repository.js';
import { SqliteUserSettingsRepository } from '../user-settings.sqlite.repository.js';
import { InMemoryFavoriteRecipeRepository } from '../favorite-recipe.in-memory.repository.js';
import { SqliteFavoriteRecipeRepository } from '../favorite-recipe.sqlite.repository.js';
import { allMigrations, runMigrations } from '../migrations/index.js';
import { createUserSettingsMigration } from '../migrations/009-create-user-settings.js';
import { createFavoriteRecipesMigration } from '../migrations/011-create-favorite-recipes.js';

const dirs: string[] = [];
const tmpDb = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'uset-'));
  dirs.push(d);
  return path.join(d, 'test.db');
};
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

const settings: UserSettings = {
  alertWithinDays: 3,
  diet: 'vegan',
  intolerances: ['egg', 'soy'],
  channel: 'webhook',
};

const settingsSuites: [string, () => UserSettingsRepositoryPort][] = [
  ['in-memory', () => new InMemoryUserSettingsRepository()],
  ['sqlite', () => new SqliteUserSettingsRepository(tmpDb())],
];

describe.each(settingsSuites)('UserSettings repository (%s)', (_n, make) => {
  it('returns null when absent, round-trips, overwrites and isolates users', async () => {
    const r = make();
    expect(await r.get('u1')).toBeNull();
    await r.upsert('u1', settings);
    expect(await r.get('u1')).toEqual(settings);
    await r.upsert('u1', { alertWithinDays: null, diet: null, intolerances: [], channel: 'console' });
    expect(await r.get('u1')).toEqual({ alertWithinDays: null, diet: null, intolerances: [], channel: 'console' });
    expect(await r.get('u2')).toBeNull();
  });
});

const now = new Date('2026-01-01T00:00:00Z');
const fav = (id: number, createdAt = now) => ({ recipeId: id, title: `R${id}`, createdAt });

const favSuites: [string, () => FavoriteRecipeRepositoryPort][] = [
  ['in-memory', () => new InMemoryFavoriteRecipeRepository()],
  ['sqlite', () => new SqliteFavoriteRecipeRepository(tmpDb())],
];

describe.each(favSuites)('FavoriteRecipe repository (%s)', (_n, make) => {
  it('upserts idempotently, orders newest first, isolates users', async () => {
    const r = make();
    await r.upsert('u1', fav(1, new Date('2026-01-01T00:00:00Z')));
    await r.upsert('u1', fav(2, new Date('2026-01-02T00:00:00Z')));
    const again = await r.upsert('u1', { ...fav(1, new Date('2026-02-01T00:00:00Z')), title: 'Renamed', imageUrl: 'https://x.test/i.jpg' });
    expect(again.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    const list = await r.list('u1');
    expect(list.map((f) => f.recipeId)).toEqual([2, 1]);
    expect(list[1].title).toBe('Renamed');
    expect(list[1].imageUrl).toBe('https://x.test/i.jpg');
    expect(await r.list('u2')).toEqual([]);
    expect(await r.ids('u1')).toEqual(new Set([1, 2]));
  });

  it('remove returns false when absent', async () => {
    const r = make();
    await r.upsert('u1', fav(1));
    expect(await r.remove('u1', 1)).toBe(true);
    expect(await r.remove('u1', 1)).toBe(false);
    expect(await r.ids('u1')).toEqual(new Set());
  });
});

describe('migrations 009 / 011', () => {
  it('are idempotent and migrate a legacy database', () => {
    const file = tmpDb();
    const legacy = new Database(file);
    runMigrations(legacy, allMigrations.filter((m) => m.id <= 7));
    legacy.close();

    const repo = new SqliteUserSettingsRepository(file);
    repo.close();
    const db = new Database(file);
    createUserSettingsMigration.up(db);
    createFavoriteRecipesMigration.up(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(['user_settings', 'favorite_recipes']));
    db.close();
  });
});

describe('SqliteUserSettingsRepository corrupt intolerances', () => {
  it.each(['not json', '{"a":1}'])('falls back to [] for %s', async (raw) => {
    const file = tmpDb();
    const repo = new SqliteUserSettingsRepository(file);
    await repo.upsert('u1', settings);
    const db = new Database(file);
    db.prepare('UPDATE user_settings SET intolerances = ? WHERE user_id = ?').run(raw, 'u1');
    db.close();
    expect((await repo.get('u1'))?.intolerances).toEqual([]);
  });
});
