import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, makeCreateFoodItemInput, registerTestUser } from './test-app.js';

describe('AuthController (HTTP)', () => {
  let app: Application;

  beforeEach(() => {
    ({ app } = buildTestApp());
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns a token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'alice@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: 'alice@example.com' });
      expect(res.body.user.id).toEqual(expect.any(String));
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 400 when the password is too short', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'alice@example.com', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 400 when the email is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('returns 409 when the email is already registered', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'alice@example.com', password: 'password123' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'alice@example.com', password: 'different123' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'alice@example.com', password: 'password123' });
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'alice@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user.email).toBe('alice@example.com');
    });

    it('returns 401 for a wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'alice@example.com', password: 'wrong-password' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for an unknown email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('returns 400 for a malformed request body', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: 'alice@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('protected routes', () => {
    it('rejects requests without an Authorization header with 401', async () => {
      const res = await request(app).get('/api/v1/food-items');
      expect(res.status).toBe(401);
    });

    it('rejects requests with a malformed Authorization header with 401', async () => {
      const res = await request(app)
        .get('/api/v1/food-items')
        .set('Authorization', 'not-a-bearer-token');
      expect(res.status).toBe(401);
    });

    it('rejects requests with an invalid token with 401', async () => {
      const res = await request(app)
        .get('/api/v1/food-items')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('allows requests with a valid token', async () => {
      const { authHeader } = await registerTestUser(app);

      const res = await request(app).get('/api/v1/food-items').set('Authorization', authHeader);
      expect(res.status).toBe(200);
    });
  });

  describe('multi-user data isolation', () => {
    it('does not show food items created by user A to user B', async () => {
      const userA = await registerTestUser(app);
      const userB = await registerTestUser(app);

      const createRes = await request(app)
        .post('/api/v1/food-items')
        .set('Authorization', userA.authHeader)
        .send(makeCreateFoodItemInput({ name: "A's Eggs" }));
      expect(createRes.status).toBe(201);
      const itemId = createRes.body.id;

      const listAsB = await request(app)
        .get('/api/v1/food-items')
        .set('Authorization', userB.authHeader);
      expect(listAsB.status).toBe(200);
      expect(listAsB.body.data).toEqual([]);

      const getAsB = await request(app)
        .get(`/api/v1/food-items/${itemId}`)
        .set('Authorization', userB.authHeader);
      expect(getAsB.status).toBe(404);

      const listAsA = await request(app)
        .get('/api/v1/food-items')
        .set('Authorization', userA.authHeader);
      expect(listAsA.status).toBe(200);
      expect(listAsA.body.data).toHaveLength(1);
    });

    it('does not allow user B to update or delete user A items', async () => {
      const userA = await registerTestUser(app);
      const userB = await registerTestUser(app);

      const createRes = await request(app)
        .post('/api/v1/food-items')
        .set('Authorization', userA.authHeader)
        .send(makeCreateFoodItemInput());
      const itemId = createRes.body.id;

      const updateAsB = await request(app)
        .patch(`/api/v1/food-items/${itemId}`)
        .set('Authorization', userB.authHeader)
        .send({ quantity: 99 });
      expect(updateAsB.status).toBe(404);

      const deleteAsB = await request(app)
        .delete(`/api/v1/food-items/${itemId}`)
        .set('Authorization', userB.authHeader);
      expect(deleteAsB.status).toBe(404);

      const getAsA = await request(app)
        .get(`/api/v1/food-items/${itemId}`)
        .set('Authorization', userA.authHeader);
      expect(getAsA.status).toBe(200);
      expect(getAsA.body.quantity).not.toBe(99);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns the current user for a valid token', async () => {
      const user = await registerTestUser(app);
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', user.authHeader);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['email', 'id']);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 for an invalid token', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer nope');
      expect(res.status).toBe(401);
    });
  });
});
