import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteFoodItemRepository } from '../food-item.sqlite.repository.js';
import type { FoodItem } from '../../../../core/domain/food-item.js';

const USER_ID = 'user-0000-0000-0000-0000-000000000001';

const makeItem = (overrides?: Partial<FoodItem>): FoodItem => ({
  id: '00000000-0000-0000-0000-000000000001',
  userId: USER_ID,
  name: 'Eggs',
  quantity: 12,
  unit: 'UNITS',
  location: 'FRIDGE',
  category: 'OTHER',
  bestBefore: new Date('2026-09-01'),
  addedAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  ...overrides,
});

describe('SqliteFoodItemRepository', () => {
  let repo: SqliteFoodItemRepository;

  beforeEach(() => {
    repo = new SqliteFoodItemRepository(':memory:');
  });

  afterEach(() => {
    repo.close();
  });

  describe('findAllPaginated', () => {
    it('returns a page of results sorted by bestBefore ascending', async () => {
      for (let i = 0; i < 5; i += 1) {
        await repo.save(
          makeItem({
            id: `00000000-0000-0000-0000-0000000001${i}`,
            name: `Item ${i}`,
            bestBefore: new Date(`2026-08-${10 + i}`),
          }),
        );
      }

      const result = await repo.findAllPaginated(USER_ID, {}, { page: 1, limit: 2 });

      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Item 0');
      expect(result.data[1].name).toBe('Item 1');
    });

    it('returns the correct slice for later pages', async () => {
      for (let i = 0; i < 5; i += 1) {
        await repo.save(
          makeItem({
            id: `00000000-0000-0000-0000-0000000002${i}`,
            name: `Item ${i}`,
            bestBefore: new Date(`2026-08-${10 + i}`),
          }),
        );
      }

      const result = await repo.findAllPaginated(USER_ID, {}, { page: 3, limit: 2 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Item 4');
    });

    it('applies filters before paginating, reporting the filtered total', async () => {
      await repo.save(makeItem({ id: '00000000-0000-0000-0000-000000000030', location: 'FRIDGE' }));
      await repo.save(makeItem({ id: '00000000-0000-0000-0000-000000000031', location: 'FREEZER' }));
      await repo.save(makeItem({ id: '00000000-0000-0000-0000-000000000032', location: 'FREEZER' }));

      const result = await repo.findAllPaginated(USER_ID, { location: 'FREEZER' }, { page: 1, limit: 1 });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(1);
    });

    it('returns an empty data array when the page is beyond the available results', async () => {
      await repo.save(makeItem());

      const result = await repo.findAllPaginated(USER_ID, {}, { page: 5, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(1);
    });
  });

  describe('findByNameAndLocation', () => {
    it('finds a case-insensitive match in the same location', async () => {
      const item = makeItem({ name: 'Eggs', location: 'FRIDGE' });
      await repo.save(item);

      const found = await repo.findByNameAndLocation(USER_ID, 'eggs', 'FRIDGE');
      expect(found?.id).toBe(item.id);
    });

    it('returns null when the name matches but the location differs', async () => {
      await repo.save(makeItem({ name: 'Eggs', location: 'FRIDGE' }));

      const found = await repo.findByNameAndLocation(USER_ID, 'Eggs', 'PANTRY');
      expect(found).toBeNull();
    });

    it('excludes the given id', async () => {
      const item = makeItem({ name: 'Eggs', location: 'FRIDGE' });
      await repo.save(item);

      const found = await repo.findByNameAndLocation(USER_ID, 'Eggs', 'FRIDGE', item.id);
      expect(found).toBeNull();
    });
  });

  describe('minimumQuantity', () => {
    it('round-trips minimumQuantity through save and findById', async () => {
      const item = makeItem({ minimumQuantity: 6 });
      await repo.save(item);

      const found = await repo.findById(item.id, USER_ID);
      expect(found?.minimumQuantity).toBe(6);
    });

    it('stores undefined minimumQuantity as null and reads it back as undefined', async () => {
      const item = makeItem();
      await repo.save(item);

      const found = await repo.findById(item.id, USER_ID);
      expect(found?.minimumQuantity).toBeUndefined();
    });

    it('updates minimumQuantity', async () => {
      const item = makeItem({ minimumQuantity: 6 });
      await repo.save(item);

      const updated = await repo.update(item.id, USER_ID, { minimumQuantity: 2 });
      expect(updated?.minimumQuantity).toBe(2);

      const found = await repo.findById(item.id, USER_ID);
      expect(found?.minimumQuantity).toBe(2);
    });
  });

  describe('schema migration', () => {
    it('adds the minimum_quantity column to a pre-existing database missing it', () => {
      const dir = mkdtempSync(join(tmpdir(), 'myfood-service-test-'));
      const path = join(dir, 'legacy.db');

      try {
        // Simulate an "old" on-disk database created before minimum_quantity existed.
        const legacyDb = new Database(path);
        legacyDb.exec(`
          CREATE TABLE food_items (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            quantity    REAL NOT NULL,
            unit        TEXT NOT NULL,
            location    TEXT NOT NULL,
            category    TEXT NOT NULL,
            best_before TEXT NOT NULL,
            added_at    TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            notes       TEXT
          )
        `);

        const columnsBefore = legacyDb.prepare('PRAGMA table_info(food_items)').all() as {
          name: string;
        }[];
        expect(columnsBefore.some((c) => c.name === 'minimum_quantity')).toBe(false);
        legacyDb.close();

        // Re-opening via SqliteFoodItemRepository must not throw and should add the column.
        const migratedRepo = new SqliteFoodItemRepository(path);
        const columnsAfter = new Database(path).prepare('PRAGMA table_info(food_items)').all() as {
          name: string;
        }[];
        expect(columnsAfter.some((c) => c.name === 'minimum_quantity')).toBe(true);
        migratedRepo.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('adds the user_id column (and index) to a pre-existing database missing it', () => {
      const dir = mkdtempSync(join(tmpdir(), 'myfood-service-test-'));
      const path = join(dir, 'legacy-user.db');

      try {
        const legacyDb = new Database(path);
        legacyDb.exec(`
          CREATE TABLE food_items (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            quantity    REAL NOT NULL,
            unit        TEXT NOT NULL,
            location    TEXT NOT NULL,
            category    TEXT NOT NULL,
            best_before TEXT NOT NULL,
            added_at    TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            notes       TEXT,
            minimum_quantity REAL
          )
        `);

        const columnsBefore = legacyDb.prepare('PRAGMA table_info(food_items)').all() as {
          name: string;
        }[];
        expect(columnsBefore.some((c) => c.name === 'user_id')).toBe(false);
        legacyDb.close();

        const migratedRepo = new SqliteFoodItemRepository(path);
        const columnsAfter = new Database(path).prepare('PRAGMA table_info(food_items)').all() as {
          name: string;
        }[];
        expect(columnsAfter.some((c) => c.name === 'user_id')).toBe(true);
        migratedRepo.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('brings a fully legacy database (pre-migration-system, ad-hoc columns already present, no schema_migrations table) up to the current schema without errors or data loss', () => {
      const dir = mkdtempSync(join(tmpdir(), 'myfood-service-test-'));
      const path = join(dir, 'legacy-full.db');

      try {
        // Simulate a database from before the migration system existed,
        // where the old ad-hoc guards had already run: both minimum_quantity
        // and user_id columns (plus the index) are present, but there is no
        // schema_migrations table recording that, and no users table yet.
        const legacyDb = new Database(path);
        legacyDb.exec(`
          CREATE TABLE food_items (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            quantity    REAL NOT NULL,
            unit        TEXT NOT NULL,
            location    TEXT NOT NULL,
            category    TEXT NOT NULL,
            best_before TEXT NOT NULL,
            added_at    TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            notes       TEXT,
            minimum_quantity REAL,
            user_id     TEXT
          )
        `);
        legacyDb.exec('CREATE INDEX idx_food_items_user_id ON food_items(user_id)');
        legacyDb
          .prepare(
            `INSERT INTO food_items (id, user_id, name, quantity, unit, location, category, best_before, added_at, updated_at, minimum_quantity)
             VALUES ('existing-1', 'user-abc', 'Milk', 1, 'UNITS', 'FRIDGE', 'OTHER', '2099-01-01', '2020-01-01', '2020-01-01', 2)`,
          )
          .run();

        const tablesBefore = legacyDb
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as { name: string }[];
        expect(tablesBefore.map((t) => t.name)).not.toContain('schema_migrations');
        expect(tablesBefore.map((t) => t.name)).not.toContain('users');
        legacyDb.close();

        // Constructing the repository must not throw, must not attempt to
        // re-run CREATE TABLE/ALTER TABLE statements that would fail
        // because the table/columns already exist, and must preserve the
        // pre-existing row untouched.
        const migratedRepo = new SqliteFoodItemRepository(path);

        const verifyDb = new Database(path);
        const tablesAfter = verifyDb
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as { name: string }[];
        expect(tablesAfter.map((t) => t.name)).toEqual(
          expect.arrayContaining(['food_items', 'users', 'schema_migrations']),
        );

        const migrationRows = verifyDb
          .prepare('SELECT id FROM schema_migrations ORDER BY id ASC')
          .all() as { id: number }[];
        expect(migrationRows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);

        const existingRow = verifyDb
          .prepare('SELECT * FROM food_items WHERE id = ?')
          .get('existing-1') as { name: string; user_id: string; minimum_quantity: number };
        expect(existingRow.name).toBe('Milk');
        expect(existingRow.user_id).toBe('user-abc');
        expect(existingRow.minimum_quantity).toBe(2);

        migratedRepo.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('throws at startup if the legacy database has rows with no user_id', () => {
      const dir = mkdtempSync(join(tmpdir(), 'myfood-service-test-'));
      const path = join(dir, 'legacy-orphaned.db');

      try {
        const legacyDb = new Database(path);
        legacyDb.exec(`
          CREATE TABLE food_items (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            quantity    REAL NOT NULL,
            unit        TEXT NOT NULL,
            location    TEXT NOT NULL,
            category    TEXT NOT NULL,
            best_before TEXT NOT NULL,
            added_at    TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            notes       TEXT,
            minimum_quantity REAL
          )
        `);
        legacyDb
          .prepare(
            `INSERT INTO food_items (id, name, quantity, unit, location, category, best_before, added_at, updated_at)
             VALUES ('orphan-1', 'Old Eggs', 1, 'UNITS', 'FRIDGE', 'OTHER', '2099-01-01', '2020-01-01', '2020-01-01')`,
          )
          .run();
        legacyDb.close();

        expect(() => new SqliteFoodItemRepository(path)).toThrow(/user_id/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('dispose', () => {
    it('marks an item disposed, excludes it from reads, and is not repeatable', async () => {
      await repo.save(makeItem());
      const disposed = await repo.dispose(makeItem().id, USER_ID, 'CONSUMED');
      expect(disposed?.disposition).toBe('CONSUMED');
      expect(disposed?.disposedAt).toBeInstanceOf(Date);

      expect(await repo.findById(makeItem().id, USER_ID)).toBeNull();
      expect(await repo.findAll(USER_ID)).toHaveLength(0);
      expect((await repo.findAllPaginated(USER_ID, {}, { page: 1, limit: 10 })).total).toBe(0);
      expect(await repo.findByNameAndLocation(USER_ID, 'Eggs', 'FRIDGE')).toBeNull();
      expect(await repo.dispose(makeItem().id, USER_ID, 'DISCARDED')).toBeNull();
      expect(await repo.delete(makeItem().id, USER_ID)).toBe(true);
    });

    it('does not dispose another user\'s item', async () => {
      await repo.save(makeItem());
      expect(await repo.dispose(makeItem().id, 'someone-else', 'CONSUMED')).toBeNull();
    });
  });
});
