import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteFoodItemRepository } from '../food-item.sqlite.repository.js';
import { SqliteUserRepository } from '../user.sqlite.repository.js';
import { FoodItemService } from '../../../../application/food-item.service.js';
import { AuthService } from '../../../../application/auth.service.js';
import { ConflictError } from '../../../../core/domain/errors.js';
import type { FoodItem } from '../../../../core/domain/food-item.js';

const make = (id: string, name: string, location: FoodItem['location'] = 'FRIDGE'): FoodItem => ({
  id,
  userId: 'u1',
  name,
  quantity: 1,
  unit: 'UNITS',
  location,
  category: 'OTHER',
  bestBefore: new Date('2026-09-01'),
  addedAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
});

describe('SqliteFoodItemRepository duplicate handling', () => {
  let repo: SqliteFoodItemRepository;
  beforeEach(() => {
    repo = new SqliteFoodItemRepository(':memory:');
  });
  afterEach(() => repo.close());

  it('save throws ConflictError for case-insensitive duplicates', async () => {
    await repo.save(make('1', 'Milk'));
    await expect(repo.save(make('2', 'MILK'))).rejects.toThrow(ConflictError);
  });

  it('update renaming into an existing name throws ConflictError', async () => {
    await repo.save(make('1', 'Milk'));
    await repo.save(make('2', 'Eggs'));
    await expect(repo.update('2', 'u1', { name: 'milk' })).rejects.toThrow(ConflictError);
  });

  it('allows re-saving after dispose', async () => {
    await repo.save(make('1', 'Milk'));
    await repo.dispose('1', 'u1', 'CONSUMED');
    await expect(repo.save(make('2', 'Milk'))).resolves.toBeDefined();
  });

  it('concurrent service.addItem yields exactly one ConflictError', async () => {
    const service = new FoodItemService(repo);
    const input = { name: 'Milk', quantity: 1, unit: 'UNITS', location: 'FRIDGE', category: 'OTHER', bestBefore: new Date('2026-09-01') } as never;
    const results = await Promise.allSettled([service.addItem('u1', input), service.addItem('u1', input)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
  });
});

describe('SqliteUserRepository duplicate handling', () => {
  let repo: SqliteUserRepository;
  beforeEach(() => {
    repo = new SqliteUserRepository(':memory:');
  });
  afterEach(() => repo.close());

  const user = (id: string, email: string) => ({ id, email, passwordHash: 'h', createdAt: new Date() });

  it('create throws ConflictError on duplicate email', async () => {
    await repo.create(user('1', 'a@b.com'));
    await expect(repo.create(user('2', 'a@b.com'))).rejects.toThrow(ConflictError);
  });

  it('concurrent register yields exactly one ConflictError', async () => {
    const auth = new AuthService(repo, 'test-secret-not-for-production', '1h');
    const input = { email: 'x@y.com', password: 'password123' };
    const results = await Promise.allSettled([auth.register(input), auth.register(input)]);
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
  });
});
