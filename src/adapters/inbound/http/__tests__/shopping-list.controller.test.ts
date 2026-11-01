import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, seedFoodItem, registerTestUser } from './test-app.js';
import { InMemoryFoodItemRepository } from '../../../outbound/persistence/food-item.in-memory.repository.js';

describe('shopping list (HTTP)', () => {
  let app: Application;
  let repo: InMemoryFoodItemRepository;
  let authHeader: string;
  let userId: string;
  beforeEach(async () => {
    ({ app, repo } = buildTestApp());
    ({ userId, authHeader } = await registerTestUser(app));
  });

  const add = (body: object, h = authHeader) =>
    request(app).post('/api/v1/shopping/list').set('Authorization', h).send(body);

  it('requires auth on all routes', async () => {
    const id = '11111111-1111-1111-1111-111111111111';
    for (const [m, p] of [
      ['get', '/shopping/list'],
      ['post', '/shopping/list'],
      ['post', '/shopping/list/import'],
      ['post', '/shopping/list/clear-checked'],
      ['patch', `/shopping/list/${id}`],
      ['delete', `/shopping/list/${id}`],
    ] as const) {
      expect((await request(app)[m](`/api/v1${p}`)).status).toBe(401);
    }
  });

  it('supports CRUD', async () => {
    const created = await add({ name: ' Bread ', quantity: 2, unit: 'UNITS' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Bread', category: 'OTHER', checked: false });
    const id = created.body.id;

    const patched = await request(app)
      .patch(`/api/v1/shopping/list/${id}`)
      .set('Authorization', authHeader)
      .send({ checked: true });
    expect(patched.status).toBe(200);
    expect(patched.body.checked).toBe(true);
    expect(patched.body.name).toBe('Bread');

    const list = await request(app).get('/api/v1/shopping/list').set('Authorization', authHeader);
    expect(list.body).toHaveLength(1);

    const cleared = await request(app)
      .post('/api/v1/shopping/list/clear-checked')
      .set('Authorization', authHeader);
    expect(cleared.body).toEqual({ removed: 1 });

    await add({ name: 'Eggs' }).then(async (r) => {
      const del = await request(app)
        .delete(`/api/v1/shopping/list/${r.body.id}`)
        .set('Authorization', authHeader);
      expect(del.status).toBe(204);
      const again = await request(app)
        .delete(`/api/v1/shopping/list/${r.body.id}`)
        .set('Authorization', authHeader);
      expect(again.status).toBe(404);
    });
  });

  it('rejects bad bodies', async () => {
    expect((await add({})).status).toBe(400);
    expect((await add({ name: 'x', quantity: -1 })).status).toBe(400);
    const { body } = await add({ name: 'x' });
    const res = await request(app)
      .patch(`/api/v1/shopping/list/${body.id}`)
      .set('Authorization', authHeader)
      .send({});
    expect(res.status).toBe(400);
    const bad = await request(app)
      .patch('/api/v1/shopping/list/not-a-uuid')
      .set('Authorization', authHeader)
      .send({ checked: true });
    expect(bad.status).toBe(400);
  });

  it('isolates users (404 cross-user)', async () => {
    const other = await registerTestUser(app);
    const { body } = await add({ name: 'Mine' });
    const patch = await request(app)
      .patch(`/api/v1/shopping/list/${body.id}`)
      .set('Authorization', other.authHeader)
      .send({ checked: true });
    expect(patch.status).toBe(404);
    const del = await request(app)
      .delete(`/api/v1/shopping/list/${body.id}`)
      .set('Authorization', other.authHeader);
    expect(del.status).toBe(404);
    const list = await request(app).get('/api/v1/shopping/list').set('Authorization', other.authHeader);
    expect(list.body).toEqual([]);
  });

  it('import is not captured by :id, dedupes and leaves inventory alone', async () => {
    await seedFoodItem(repo, { userId, name: 'Milk', bestBefore: new Date('2020-01-01T00:00:00Z') });
    await add({ name: 'milk' });
    let res = await request(app).post('/api/v1/shopping/list/import').set('Authorization', authHeader);
    expect(res.status).toBe(201);
    expect(res.body).toEqual([]);

    await request(app).post('/api/v1/shopping/list/clear-checked').set('Authorization', authHeader);
    const list = await request(app).get('/api/v1/shopping/list').set('Authorization', authHeader);
    for (const i of list.body) {
      await request(app).delete(`/api/v1/shopping/list/${i.id}`).set('Authorization', authHeader);
    }
    res = await request(app).post('/api/v1/shopping/list/import').set('Authorization', authHeader);
    expect(res.status).toBe(201);
    expect(res.body.map((i: { name: string }) => i.name)).toEqual(['Milk']);
    expect(await repo.findAll(userId)).toHaveLength(1);
  });
});
