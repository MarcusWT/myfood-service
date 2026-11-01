import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ShoppingListItem } from '../../../../core/domain/shopping-list.js';
import type { ShoppingListRepositoryPort } from '../../../../core/ports/outbound/shopping-list.repository.port.js';
import { InMemoryShoppingListRepository } from '../shopping-list.in-memory.repository.js';
import { SqliteShoppingListRepository } from '../shopping-list.sqlite.repository.js';

const dirs: string[] = [];
const tmpDb = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'slist-'));
  dirs.push(d);
  return path.join(d, 'test.db');
};
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

let n = 0;
const mk = (userId: string, o: Partial<ShoppingListItem> = {}): ShoppingListItem => {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    userId,
    name: `item${n}`,
    category: 'OTHER',
    checked: false,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, n)),
    ...o,
  };
};

const suites: [string, () => ShoppingListRepositoryPort][] = [
  ['in-memory', () => new InMemoryShoppingListRepository()],
  ['sqlite', () => new SqliteShoppingListRepository(tmpDb())],
];

describe.each(suites)('ShoppingListRepository (%s)', (_n, make) => {
  it('createIfUnderLimit is atomic under concurrency and createMany is all-or-nothing', async () => {
    const r = make();
    const results = await Promise.all(Array.from({ length: 20 }, () => r.createIfUnderLimit(mk('u1'), 5)));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(await r.countByUser('u1')).toBe(5);
    expect(await r.createManyIfUnderLimit([mk('u2'), mk('u2'), mk('u2')], 2)).toBeNull();
    expect(await r.countByUser('u2')).toBe(0);
    expect(await r.createManyIfUnderLimit([mk('u2'), mk('u2')], 2)).toHaveLength(2);
    expect(await r.countByUser('u2')).toBe(2);
  });

  it('isolates users and supports CRUD', async () => {
    const r = make();
    const a = await r.create(mk('u1', { quantity: 2, unit: 'UNITS' }));
    await r.create(mk('u2'));
    expect(await r.findAll('u1')).toHaveLength(1);
    expect(await r.findById('u2', a.id)).toBeNull();
    expect(await r.update('u2', a.id, { checked: true })).toBeNull();
    const upd = await r.update('u1', a.id, { checked: true, name: 'Renamed' });
    expect(upd).toMatchObject({ checked: true, name: 'Renamed', quantity: 2, unit: 'UNITS' });
    expect(await r.delete('u2', a.id)).toBe(false);
    expect(await r.delete('u1', a.id)).toBe(true);
    expect(await r.countByUser('u1')).toBe(0);
  });

  it('deleteChecked returns the count for only that user', async () => {
    const r = make();
    await r.create(mk('u1', { checked: true }));
    await r.create(mk('u1', { checked: true }));
    await r.create(mk('u1'));
    await r.create(mk('u2', { checked: true }));
    expect(await r.deleteChecked('u1')).toBe(2);
    expect(await r.countByUser('u1')).toBe(1);
    expect(await r.countByUser('u2')).toBe(1);
  });
});

describe('SqliteShoppingListRepository on disk', () => {
  it('persists and re-opens idempotently', async () => {
    const file = tmpDb();
    const a = new SqliteShoppingListRepository(file);
    await a.create(mk('u1'));
    a.close();
    const b = new SqliteShoppingListRepository(file);
    expect(await b.countByUser('u1')).toBe(1);
    b.close();
  });
});
