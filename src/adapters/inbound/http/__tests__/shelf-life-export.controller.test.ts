import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, seedFoodItem, registerTestUser } from './test-app.js';
import { InMemoryFoodItemRepository } from '../../../outbound/persistence/food-item.in-memory.repository.js';

describe('shelf-life endpoints', () => {
  let app: Application;
  let authHeader: string;
  beforeEach(async () => {
    ({ app } = buildTestApp());
    ({ authHeader } = await registerTestUser(app));
  });

  it('requires auth', async () => {
    expect((await request(app).get('/api/v1/food-items/shelf-life?category=DAIRY&location=FRIDGE')).status).toBe(401);
  });

  it('returns suggestion (not captured by /:id)', async () => {
    const res = await request(app)
      .get('/api/v1/food-items/shelf-life?category=DAIRY&location=FRIDGE')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ category: 'DAIRY', location: 'FRIDGE', days: 7, source: 'default-table' });
    expect(new Date(res.body.suggestedBestBefore).toString()).not.toBe('Invalid Date');
  });

  it('returns days:null when not recommended', async () => {
    const res = await request(app)
      .get('/api/v1/food-items/shelf-life?category=MEAT&location=PANTRY')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.days).toBeNull();
    expect(res.body.suggestedBestBefore).toBeNull();
  });

  it('400 on invalid or missing params', async () => {
    for (const q of ['category=NOPE&location=FRIDGE', 'category=DAIRY', '']) {
      const res = await request(app)
        .get(`/api/v1/food-items/shelf-life?${q}`)
        .set('Authorization', authHeader);
      expect(res.status).toBe(400);
    }
  });

  it('serves the table', async () => {
    const res = await request(app)
      .get('/api/v1/food-items/shelf-life/table')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.table.DAIRY.FRIDGE).toBe(7);
    expect(res.body.table.SNACKS.FRIDGE).toBeNull();
  });
});

describe('GET /api/v1/food-items/export', () => {
  let app: Application;
  let repo: InMemoryFoodItemRepository;
  let authHeader: string;
  let userId: string;
  beforeEach(async () => {
    ({ app, repo } = buildTestApp());
    ({ userId, authHeader } = await registerTestUser(app));
  });

  it('requires auth', async () => {
    expect((await request(app).get('/api/v1/food-items/export')).status).toBe(401);
  });

  it('exports JSON by default with attachment headers', async () => {
    await seedFoodItem(repo, { userId });
    const res = await request(app).get('/api/v1/food-items/export').set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="myfood-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].name).toBe('Milk');
    expect(res.body.exportedAt).toBeDefined();
  });

  it('exports CSV with guarded malicious names', async () => {
    await seedFoodItem(repo, { userId, name: '=HYPERLINK("x")' });
    const res = await request(app)
      .get('/api/v1/food-items/export?format=csv')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('.csv"');
    expect(res.text).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('isolates users and excludes disposed items', async () => {
    const other = await registerTestUser(app);
    await seedFoodItem(repo, { userId });
    await seedFoodItem(repo, {
      userId,
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Gone',
      disposition: 'CONSUMED',
      disposedAt: new Date(),
    } as never);
    await seedFoodItem(repo, {
      userId: other.userId,
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Theirs',
    });
    const res = await request(app).get('/api/v1/food-items/export').set('Authorization', authHeader);
    expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(['Milk']);
  });

  it('400 on bad format', async () => {
    const res = await request(app)
      .get('/api/v1/food-items/export?format=xml')
      .set('Authorization', authHeader);
    expect(res.status).toBe(400);
  });
});
