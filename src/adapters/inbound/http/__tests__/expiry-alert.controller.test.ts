import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, seedFoodItem } from './test-app.js';
import { InMemoryFoodItemRepository } from '../../../outbound/persistence/food-item.in-memory.repository.js';

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

describe('ExpiryAlertController (HTTP)', () => {
  let app: Application;
  let repo: InMemoryFoodItemRepository;

  beforeEach(() => {
    ({ app, repo } = buildTestApp());
  });

  describe('GET /api/v1/alerts/expiry', () => {
    it('returns an empty array when nothing is expiring', async () => {
      const res = await request(app).get('/api/v1/alerts/expiry');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns alerts for items within the default window', async () => {
      await seedFoodItem(repo, {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Yoghurt',
        bestBefore: daysFromNow(2),
      });

      const res = await request(app).get('/api/v1/alerts/expiry');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].item.name).toBe('Yoghurt');
      expect(res.body[0].status).toBe('CRITICAL');
    });

    it('respects the withinDays query param', async () => {
      await seedFoodItem(repo, {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Yoghurt',
        bestBefore: daysFromNow(2),
      });

      const excluded = await request(app)
        .get('/api/v1/alerts/expiry')
        .query({ withinDays: 1 });
      expect(excluded.status).toBe(200);
      expect(excluded.body).toEqual([]);

      const included = await request(app)
        .get('/api/v1/alerts/expiry')
        .query({ withinDays: 3 });
      expect(included.status).toBe(200);
      expect(included.body).toHaveLength(1);
    });

    it('returns 400 when withinDays is not positive', async () => {
      const res = await request(app).get('/api/v1/alerts/expiry').query({ withinDays: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 when withinDays is not numeric', async () => {
      const res = await request(app).get('/api/v1/alerts/expiry').query({ withinDays: 'soon' });

      expect(res.status).toBe(400);
    });
  });
});
