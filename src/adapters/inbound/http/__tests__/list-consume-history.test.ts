import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, registerTestUser, seedFoodItem, makeCreateFoodItemInput } from './test-app.js';
import type { InMemoryFoodItemRepository } from '../../../outbound/persistence/food-item.in-memory.repository.js';

describe('list params, consume, history, stats, restore', () => {
  let app: Application;
  let repo: InMemoryFoodItemRepository;
  let auth: string;
  let userId: string;
  let n = 0;
  const id = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12, '0')}`;
  const seed = (o: Record<string, unknown> = {}) => seedFoodItem(repo, { id: id(), userId, name: `Item${n}`, ...o });

  beforeEach(async () => {
    ({ app, repo } = buildTestApp());
    ({ authHeader: auth, userId } = await registerTestUser(app));
  });

  describe('GET /food-items query', () => {
    it.each([
      'sort=bogus', 'order=up', 'status=old', 'expiringBefore=nope', 'limit=101', 'limit=0', 'page=0',
      'sort=name;DROP', 'lowStock=maybe',
    ])('400 for %s', async (qs) => {
      const res = await request(app).get(`/api/v1/food-items?${qs}`).set('Authorization', auth);
      expect(res.status).toBe(400);
    });

    it('accepts limit=100 and returns totalPages (0 when empty)', async () => {
      const res = await request(app).get('/api/v1/food-items?limit=100').set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 0, totalPages: 0, limit: 100 });
    });

    it('sorts, filters lowStock=false and keeps default order', async () => {
      await seed({ name: 'b', bestBefore: new Date('2026-09-01'), quantity: 1, minimumQuantity: 3 });
      await seed({ name: 'a', bestBefore: new Date('2026-09-02') });
      const def = await request(app).get('/api/v1/food-items').set('Authorization', auth);
      expect(def.body.data.map((i: { name: string }) => i.name)).toEqual(['b', 'a']);
      const byName = await request(app).get('/api/v1/food-items?sort=name&order=asc').set('Authorization', auth);
      expect(byName.body.data.map((i: { name: string }) => i.name)).toEqual(['a', 'b']);
      const notLow = await request(app).get('/api/v1/food-items?lowStock=false').set('Authorization', auth);
      expect(notLow.body.data.map((i: { name: string }) => i.name)).toEqual(['a']);
      const low = await request(app).get('/api/v1/food-items?lowStock=true').set('Authorization', auth);
      expect(low.body.data.map((i: { name: string }) => i.name)).toEqual(['b']);
    });
  });

  describe('POST /:id/consume', () => {
    it('401 without auth', async () => {
      expect((await request(app).post(`/api/v1/food-items/${id()}/consume`).send({ amount: 1 })).status).toBe(401);
    });

    it('partial consume, low stock appears in shopping summary', async () => {
      const item = await seed({ name: 'LowThing', quantity: 5, minimumQuantity: 3, bestBefore: new Date('2099-01-01') });
      const res = await request(app).post(`/api/v1/food-items/${item.id}/consume`).set('Authorization', auth).send({ amount: 3 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ disposed: false, lowStock: true, item: { quantity: 2 } });
      const summary = await request(app).get('/api/v1/shopping/summary').set('Authorization', auth);
      expect(JSON.stringify(summary.body)).toContain('LOW_STOCK');
    });

    it('full consume disposes and then GET is 404; history lists it', async () => {
      const item = await seed({ quantity: 2 });
      const res = await request(app).post(`/api/v1/food-items/${item.id}/consume`).set('Authorization', auth).send({ amount: 5 });
      expect(res.body).toMatchObject({ disposed: true, lowStock: false });
      expect(res.body.item.disposition).toBe('CONSUMED');
      expect((await request(app).get(`/api/v1/food-items/${item.id}`).set('Authorization', auth)).status).toBe(404);
      const hist = await request(app).get('/api/v1/food-items/history').set('Authorization', auth);
      expect(hist.body.data.map((i: { id: string }) => i.id)).toEqual([item.id]);
      const again = await request(app).post(`/api/v1/food-items/${item.id}/consume`).set('Authorization', auth).send({ amount: 1 });
      expect(again.status).toBe(404);
    });

    it.each([[{ amount: 0 }], [{ amount: -2 }], [{ amount: '1' }], [{}]])('400 for %j', async (body) => {
      const item = await seed();
      const res = await request(app).post(`/api/v1/food-items/${item.id}/consume`).set('Authorization', auth).send(body);
      expect(res.status).toBe(400);
    });

    it('404 for unknown and other user', async () => {
      const item = await seed();
      const other = await registerTestUser(app);
      expect((await request(app).post(`/api/v1/food-items/${id()}/consume`).set('Authorization', auth).send({ amount: 1 })).status).toBe(404);
      expect((await request(app).post(`/api/v1/food-items/${item.id}/consume`).set('Authorization', other.authHeader).send({ amount: 1 })).status).toBe(404);
    });
  });

  describe('history', () => {
    it('is not captured by :id, requires auth, validates', async () => {
      expect((await request(app).get('/api/v1/food-items/history')).status).toBe(401);
      const ok = await request(app).get('/api/v1/food-items/history').set('Authorization', auth);
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ data: [], total: 0, totalPages: 0 });
      for (const qs of ['outcome=NOPE', 'from=bad', 'from=2026-02-01&to=2026-01-01', 'limit=101']) {
        expect((await request(app).get(`/api/v1/food-items/history?${qs}`).set('Authorization', auth)).status).toBe(400);
      }
    });

    it('date-only `to` includes the whole UTC day; full datetimes unchanged', async () => {
      const a = await seed({ disposition: 'CONSUMED', disposedAt: new Date('2026-05-10T18:00:00.000Z') });
      const get = async (qs: string) =>
        (await request(app).get(`/api/v1/food-items/history?${qs}`).set('Authorization', auth)).body.data.map((i: { id: string }) => i.id);
      expect(await get('to=2026-05-10')).toEqual([a.id]);
      expect(await get('to=2026-05-10T12:00:00Z')).toEqual([]);
      expect(await get('from=2026-05-10')).toEqual([a.id]);
      const stats = await request(app).get('/api/v1/stats/waste?from=2026-05-10&to=2026-05-10').set('Authorization', auth);
      expect(stats.body.totals.total).toBe(1);
      expect((await request(app).get('/api/v1/food-items/history?to=2026-13-40').set('Authorization', auth)).status).toBe(400);
    });

    it('date-only expiringBefore includes that whole UTC day', async () => {
      const a = await seed({ bestBefore: new Date('2026-12-01T20:00:00.000Z') });
      const res = await request(app).get('/api/v1/food-items?expiringBefore=2026-12-01').set('Authorization', auth);
      expect(res.body.data.map((i: { id: string }) => i.id)).toContain(a.id);
    });

    it('filters by outcome', async () => {
      const a = await seed();
      const b = await seed();
      await request(app).post(`/api/v1/food-items/${a.id}/dispose`).set('Authorization', auth).send({ outcome: 'CONSUMED' });
      await request(app).post(`/api/v1/food-items/${b.id}/dispose`).set('Authorization', auth).send({ outcome: 'DISCARDED' });
      const res = await request(app).get('/api/v1/food-items/history?outcome=DISCARDED').set('Authorization', auth);
      expect(res.body.data.map((i: { id: string }) => i.id)).toEqual([b.id]);
    });
  });

  describe('stats/waste', () => {
    it('401, 400 and totals', async () => {
      expect((await request(app).get('/api/v1/stats/waste')).status).toBe(401);
      expect((await request(app).get('/api/v1/stats/waste?from=2026-02-01&to=2026-01-01').set('Authorization', auth)).status).toBe(400);
      const a = await seed({ category: 'DAIRY' });
      const b = await seed({ category: 'DAIRY' });
      const c = await seed({ category: 'MEAT' });
      for (const [it_, outcome] of [[a, 'CONSUMED'], [b, 'DISCARDED'], [c, 'DISCARDED']] as const) {
        await request(app).post(`/api/v1/food-items/${it_.id}/dispose`).set('Authorization', auth).send({ outcome });
      }
      const res = await request(app).get('/api/v1/stats/waste').set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.totals).toMatchObject({ consumed: 1, discarded: 2, total: 3 });
      expect(res.body.byCategory).toHaveLength(2);
      expect(res.body.byMonth).toHaveLength(1);
    });
  });

  describe('POST /:id/restore', () => {
    it('restores (200), then 404 for active, 409 on duplicate', async () => {
      const item = await seed({ name: 'Milk' });
      await request(app).post(`/api/v1/food-items/${item.id}/dispose`).set('Authorization', auth).send({ outcome: 'DISCARDED' });
      const ok = await request(app).post(`/api/v1/food-items/${item.id}/restore`).set('Authorization', auth);
      expect(ok.status).toBe(200);
      expect(ok.body.disposition).toBeUndefined();
      expect((await request(app).post(`/api/v1/food-items/${item.id}/restore`).set('Authorization', auth)).status).toBe(404);

      await request(app).post(`/api/v1/food-items/${item.id}/dispose`).set('Authorization', auth).send({ outcome: 'DISCARDED' });
      await request(app).post('/api/v1/food-items').set('Authorization', auth).send(makeCreateFoodItemInput({ name: 'milk' }));
      const conflict = await request(app).post(`/api/v1/food-items/${item.id}/restore`).set('Authorization', auth);
      expect(conflict.status).toBe(409);
    });
  });
});
