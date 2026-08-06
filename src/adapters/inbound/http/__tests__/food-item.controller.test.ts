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

    it('returns 400 when bestBefore is in the past', async () => {
      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput({ bestBefore: '2020-01-01T00:00:00.000Z' }));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 when quantity exceeds the maximum', async () => {
      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput({ quantity: 200_000 }));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('trims leading/trailing whitespace from name', async () => {
      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput({ name: '  Eggs  ' }));

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Eggs');
    });

    it('returns 409 when an item with the same name already exists in the same location', async () => {
      await request(app).post('/api/v1/food-items').send(makeCreateFoodItemInput({ name: 'Eggs', location: 'FRIDGE' }));

      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput({ name: 'eggs', location: 'FRIDGE' }));

      expect(res.status).toBe(409);
      expect(res.body.error).toEqual(expect.any(String));
    });

    it('allows the same name in a different location', async () => {
      await request(app).post('/api/v1/food-items').send(makeCreateFoodItemInput({ name: 'Eggs', location: 'FRIDGE' }));

      const res = await request(app)
        .post('/api/v1/food-items')
        .send(makeCreateFoodItemInput({ name: 'Eggs', location: 'PANTRY' }));

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/v1/food-items', () => {
    it('returns an empty envelope when no items exist', async () => {
      const res = await request(app).get('/api/v1/food-items');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], total: 0, page: 1, limit: 20 });
    });

    it('returns all seeded items within the default page', async () => {
      await seedFoodItem(repo, { id: '11111111-1111-1111-1111-111111111111', name: 'Milk' });
      await seedFoodItem(repo, { id: '22222222-2222-2222-2222-222222222222', name: 'Cheese' });

      const res = await request(app).get('/api/v1/food-items');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
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
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].name).toBe('Peas');
    });

    it('filters by name query param (partial match)', async () => {
      await seedFoodItem(repo, { id: '11111111-1111-1111-1111-111111111111', name: 'Whole Milk' });
      await seedFoodItem(repo, { id: '22222222-2222-2222-2222-222222222222', name: 'Cheddar Cheese' });

      const res = await request(app).get('/api/v1/food-items').query({ name: 'milk' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Whole Milk');
    });

    it('returns 400 when filter has an invalid category', async () => {
      const res = await request(app)
        .get('/api/v1/food-items')
        .query({ category: 'NOT_A_CATEGORY' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('paginates results according to page and limit', async () => {
      for (let i = 0; i < 25; i += 1) {
        await seedFoodItem(repo, {
          id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
          name: `Item ${i}`,
          bestBefore: new Date(Date.now() + i * 86_400_000),
        });
      }

      const page1 = await request(app).get('/api/v1/food-items').query({ page: 1, limit: 10 });
      expect(page1.status).toBe(200);
      expect(page1.body.data).toHaveLength(10);
      expect(page1.body.total).toBe(25);
      expect(page1.body.page).toBe(1);
      expect(page1.body.limit).toBe(10);

      const page3 = await request(app).get('/api/v1/food-items').query({ page: 3, limit: 10 });
      expect(page3.status).toBe(200);
      expect(page3.body.data).toHaveLength(5);
      expect(page3.body.total).toBe(25);
      expect(page3.body.page).toBe(3);
    });

    it('combines pagination with filters, reporting a filtered total', async () => {
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
      await seedFoodItem(repo, {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Corn',
        location: 'FREEZER',
      });

      const res = await request(app)
        .get('/api/v1/food-items')
        .query({ location: 'FREEZER', page: 1, limit: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(2);
    });

    it('returns 400 when limit exceeds the maximum', async () => {
      const res = await request(app).get('/api/v1/food-items').query({ limit: 1000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 when page is not a positive integer', async () => {
      const res = await request(app).get('/api/v1/food-items').query({ page: 0 });

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

    it('returns 400 when bestBefore is updated to a past date', async () => {
      const item = await seedFoodItem(repo);

      const res = await request(app)
        .patch(`/api/v1/food-items/${item.id}`)
        .send({ bestBefore: '2020-01-01T00:00:00.000Z' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('does not conflict when updating a field other than name/location on an item that already has that name', async () => {
      const item = await seedFoodItem(repo, {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Milk',
        location: 'FRIDGE',
      });

      const res = await request(app)
        .patch(`/api/v1/food-items/${item.id}`)
        .send({ quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.quantity).toBe(3);
    });

    it('returns 409 when renaming an item to collide with another item in the same location', async () => {
      await seedFoodItem(repo, {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Milk',
        location: 'FRIDGE',
      });
      const cheese = await seedFoodItem(repo, {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Cheese',
        location: 'FRIDGE',
      });

      const res = await request(app)
        .patch(`/api/v1/food-items/${cheese.id}`)
        .send({ name: 'milk' });

      expect(res.status).toBe(409);
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
