import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, makeCreateFoodItemInput, seedFoodItem } from './test-app.js';
import { InMemoryFoodItemRepository } from '../../../outbound/persistence/food-item.in-memory.repository.js';

describe('FoodItemController (HTTP)', () => {
  let app: Application;
  let repo: InMemoryFoodItemRepository;

  beforeEach(() => {
    ({ app, repo } = buildTestApp());
  });

  describe('POST /api/v1/food-items', () => {
    it('creates and returns a new food item', async () => {
      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput());

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Eggs',
        quantity: 12,
        unit: 'UNITS',
        location: 'FRIDGE',
        category: 'OTHER',
      });
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.addedAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it('returns 400 with validation details when name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput({ name: undefined }));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.details).toBeInstanceOf(Array);
    });

    it('returns 400 when quantity is not positive', async () => {
      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput({ quantity: -1 }));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 when unit is not a valid enum value', async () => {
      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput({ unit: 'BOXES' }));

      expect(res.status).toBe(400);
    });

    it('returns 400 when bestBefore is not a valid date', async () => {
      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput({ bestBefore: 'not-a-date' }));

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/food-items', () => {
    it('returns an empty array when no items exist', async () => {
      const res = await request(app).get('/api/v1/food-items');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all seeded items', async () => {
      await seedFoodItem(repo, { id: '11111111-1111-1111-1111-111111111111', name: 'Milk' });
      await seedFoodItem(repo, { id: '22222222-2222-2222-2222-222222222222', name: 'Cheese' });

      const res = await request(app).get('/api/v1/food-items');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by location query param', async () => {
      await seedFoodItem(repo, {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Milk',
        location: 'FRIDGE',
      });
      await seedFoodItem(repo, {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Peas',
        location: 'FREEZER',
      });

      const res = await request(app).get('/api/v1/food-items').query({ location: 'FREEZER' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Peas');
    });

    it('filters by name query param (partial match)', async () => {
      await seedFoodItem(repo, { id: '11111111-1111-1111-1111-111111111111', name: 'Whole Milk' });
      await seedFoodItem(repo, { id: '22222222-2222-2222-2222-222222222222', name: 'Cheddar Cheese' });

      const res = await request(app).get('/api/v1/food-items').query({ name: 'milk' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Whole Milk');
    });

    it('returns 400 when filter has an invalid category', async () => {
      const res = await request(app)
        .get('/api/v1/food-items')
        .query({ category: 'NOT_A_CATEGORY' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/v1/food-items/:id', () => {
    it('returns the item when found', async () => {
      const item = await seedFoodItem(repo);

      const res = await request(app).get(`/api/v1/food-items/${item.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(item.id);
      expect(res.body.name).toBe(item.name);
    });

    it('returns 404 when the item does not exist', async () => {
      const res = await request(app).get('/api/v1/food-items/99999999-9999-9999-9999-999999999999');

      expect(res.status).toBe(404);
      expect(res.body.error).toEqual(expect.any(String));
    });
  });

  describe('PATCH /api/v1/food-items/:id', () => {
    it('updates and returns the item on valid partial body', async () => {
      const item = await seedFoodItem(repo, { quantity: 1 });

      const res = await request(app)
        .patch(`/api/v1/food-items/${item.id}`)
        .send({ quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.quantity).toBe(5);
      expect(res.body.id).toBe(item.id);
    });

    it('returns 404 when the item does not exist', async () => {
      const res = await request(app)
        .patch('/api/v1/food-items/99999999-9999-9999-9999-999999999999')
        .send({ quantity: 5 });

      expect(res.status).toBe(404);
    });

    it('returns 400 when the update body is invalid', async () => {
      const item = await seedFoodItem(repo);

      const res = await request(app)
        .patch(`/api/v1/food-items/${item.id}`)
        .send({ quantity: -5 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('DELETE /api/v1/food-items/:id', () => {
    it('deletes the item and returns 204', async () => {
      const item = await seedFoodItem(repo);

      const res = await request(app).delete(`/api/v1/food-items/${item.id}`);

      expect(res.status).toBe(204);
      expect(await repo.findById(item.id)).toBeNull();
    });

    it('returns 404 when the item does not exist', async () => {
      const res = await request(app).delete('/api/v1/food-items/99999999-9999-9999-9999-999999999999');

      expect(res.status).toBe(404);
    });
  });
});
