import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, seedFoodItem } from './test-app.js';
import { InMemoryFoodItemRepository } from '../../../outbound/persistence/food-item.in-memory.repository.js';

describe('ShoppingSummaryController (HTTP)', () => {
  let app: Application;
  let repo: InMemoryFoodItemRepository;

  beforeEach(() => {
    ({ app, repo } = buildTestApp());
  });

  describe('GET /api/v1/shopping/summary', () => {
    it('returns an empty summary when no items exist', async () => {
      const res = await request(app).get('/api/v1/shopping/summary');

      expect(res.status).toBe(200);
      expect(res.body.totalItems).toBe(0);
      expect(res.body.byCategory).toEqual({});
      expect(res.body.generatedAt).toBeDefined();
    });

    it('includes expired and expiring-soon items grouped by category', async () => {
      const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
      const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

      await seedFoodItem(repo, {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Old Milk',
        category: 'DAIRY',
        bestBefore: yesterday,
      });
      await seedFoodItem(repo, {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Soon Cheese',
        category: 'DAIRY',
        bestBefore: tomorrow,
      });
      await seedFoodItem(repo, {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Frozen Peas',
        category: 'FROZEN',
        bestBefore: farFuture,
      });

      const res = await request(app).get('/api/v1/shopping/summary');

      expect(res.status).toBe(200);
      expect(res.body.totalItems).toBe(2);
      expect(res.body.byCategory.DAIRY).toHaveLength(2);
      expect(res.body.byCategory.FROZEN).toBeUndefined();

      const reasons = res.body.byCategory.DAIRY.map((i: { reason: string }) => i.reason);
      expect(reasons).toContain('EXPIRED');
      expect(reasons).toContain('EXPIRING_SOON');
    });
  });
});
