import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, seedFoodItem, registerTestUser } from './test-app.js';
import type { RecipeProviderPort } from '../../../../core/ports/outbound/recipe-provider.port.js';
import type { Recipe } from '../../../../core/domain/recipe.js';
import type { InMemoryFoodItemRepository } from '../../../outbound/persistence/food-item.in-memory.repository.js';

const body = { alertWithinDays: 5, diet: 'vegetarian', intolerances: ['soy', 'egg', 'soy'], channel: 'console' };

describe('Settings (HTTP)', () => {
  let app: Application;
  let auth: string;
  beforeEach(async () => {
    ({ app } = buildTestApp());
    ({ authHeader: auth } = await registerTestUser(app));
  });

  it('requires auth', async () => {
    expect((await request(app).get('/api/v1/settings')).status).toBe(401);
    expect((await request(app).put('/api/v1/settings').send(body)).status).toBe(401);
  });

  it('returns defaults, then PUT and GET persist (deduped/sorted)', async () => {
    const d = await request(app).get('/api/v1/settings').set('Authorization', auth);
    expect(d.body).toEqual({ alertWithinDays: null, diet: null, intolerances: [], channel: 'console' });
    const put = await request(app).put('/api/v1/settings').set('Authorization', auth).send(body);
    expect(put.status).toBe(200);
    expect(put.body.intolerances).toEqual(['egg', 'soy']);
    const get = await request(app).get('/api/v1/settings').set('Authorization', auth);
    expect(get.body).toEqual(put.body);
  });

  it.each([
    { ...body, diet: 'carnivore' },
    { ...body, alertWithinDays: 0 },
    { ...body, alertWithinDays: 366 },
    { ...body, extra: 1 },
  ])('rejects invalid body %#', async (bad) => {
    const res = await request(app).put('/api/v1/settings').set('Authorization', auth).send(bad);
    expect(res.status).toBe(400);
  });

  it('isolates users', async () => {
    await request(app).put('/api/v1/settings').set('Authorization', auth).send(body);
    const other = await registerTestUser(app);
    const res = await request(app).get('/api/v1/settings').set('Authorization', other.authHeader);
    expect(res.body.diet).toBeNull();
  });
});

describe('Favourite recipes and recipe preferences (HTTP)', () => {
  let app: Application;
  let repo: InMemoryFoodItemRepository;
  let auth: string;
  let userId: string;
  let provider: RecipeProviderPort;
  const recipe = (id: number, used: string[]): Recipe => ({
    id,
    title: `R${id}`,
    readyInMinutes: 1,
    servings: 1,
    usedIngredients: used.map((name) => ({ name, amount: 1, unit: '' })),
    missedIngredients: [],
    matchScore: 50,
  });

  beforeEach(async () => {
    provider = { findByIngredients: vi.fn().mockResolvedValue([recipe(1, ['rice']), recipe(2, ['milk'])]) };
    ({ app, repo } = buildTestApp(provider));
    ({ userId, authHeader: auth } = await registerTestUser(app));
  });

  it('PUT/GET/DELETE favourites idempotently', async () => {
    expect((await request(app).get('/api/v1/recipes/favorites')).status).toBe(401);
    const put = () =>
      request(app).put('/api/v1/recipes/favorites/7').set('Authorization', auth).send({ title: 'Soup', sourceUrl: 'https://x.test/s' });
    expect((await put()).status).toBe(200);
    expect((await put()).status).toBe(200);
    const list = await request(app).get('/api/v1/recipes/favorites').set('Authorization', auth);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ recipeId: 7, title: 'Soup' });
    expect((await request(app).delete('/api/v1/recipes/favorites/7').set('Authorization', auth)).status).toBe(204);
    expect((await request(app).delete('/api/v1/recipes/favorites/7').set('Authorization', auth)).status).toBe(204);
  });

  it('rejects bad ids and bodies', async () => {
    const put = (id: string, b: object) => request(app).put(`/api/v1/recipes/favorites/${id}`).set('Authorization', auth).send(b);
    expect((await put('abc', { title: 'x' })).status).toBe(400);
    expect((await put('0', { title: 'x' })).status).toBe(400);
    expect((await put('1', {})).status).toBe(400);
    expect((await request(app).delete('/api/v1/recipes/favorites/-1').set('Authorization', auth)).status).toBe(400);
  });

  it('forwards diet/intolerances, re-ranks expiring recipes first and flags favourites', async () => {
    await seedFoodItem(repo, { userId, id: '11111111-1111-1111-1111-111111111111', name: 'Rice', bestBefore: new Date(Date.now() + 20 * 86_400_000) });
    await seedFoodItem(repo, { userId, id: '11111111-1111-1111-1111-111111111112', name: 'Milk', bestBefore: new Date(Date.now() + 2 * 86_400_000) });
    await request(app).put('/api/v1/settings').set('Authorization', auth).send(body);
    await request(app).put('/api/v1/recipes/favorites/1').set('Authorization', auth).send({ title: 'R1' });

    const res = await request(app).get('/api/v1/recipes/suggestions').set('Authorization', auth);
    expect(provider.findByIngredients).toHaveBeenCalledWith(expect.any(Array), 5, {
      diet: 'vegetarian',
      intolerances: ['egg', 'soy'],
    });
    expect(res.body.map((r: Recipe) => r.id)).toEqual([2, 1]);
    expect(res.body[0].expiringSoon).toEqual(['milk']);
    expect(res.body[1].isFavorite).toBe(true);
    expect(res.body[0].isFavorite).toBeUndefined();
  });

  it('caps favourites at 500 per user with 422 (re-adding an existing one still works)', async () => {
    const put = (id: number) => request(app).put(`/api/v1/recipes/favorites/${id}`).set('Authorization', auth).send({ title: `R${id}` });
    for (let i = 1; i <= 500; i++) expect((await put(i)).status).toBeLessThan(300);
    expect((await put(501)).status).toBe(422);
    expect((await put(1)).status).toBeLessThan(300);
  }, 30000);
});
