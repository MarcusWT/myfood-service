import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { buildTestApp, registerTestUser } from './test-app.js';
import { logger } from '../../../../logger.js';
import { errorHandler } from '../error-handler.js';
import { ConflictError } from '../../../../core/domain/errors.js';

describe('malformed JSON and id params', () => {
  let app: Application;
  let authHeader: string;

  beforeEach(async () => {
    ({ app } = buildTestApp());
    ({ authHeader } = await registerTestUser(app));
  });

  it('returns 400 for malformed JSON without leaking or logging the body', async () => {
    const spy = vi.spyOn(logger, 'error');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":"a@b.com","password":"hunter2-secret"');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Malformed JSON' });
    expect(JSON.stringify(res.body)).not.toContain('hunter2-secret');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it.each([
    ['get', '/api/v1/food-items/garbage'],
    ['patch', '/api/v1/food-items/garbage'],
    ['post', '/api/v1/food-items/garbage/dispose'],
    ['post', '/api/v1/food-items/garbage/consume'],
    ['post', '/api/v1/food-items/garbage/restore'],
    ['delete', '/api/v1/food-items/garbage'],
  ] as const)('%s %s -> 400', async (method, url) => {
    const res = await request(app)[method](url)
      .set('Authorization', authHeader)
      .send({ outcome: 'CONSUMED', name: 'x' });
    expect(res.status).toBe(400);
  });

  it('still returns 404 for an unknown but valid uuid', async () => {
    const res = await request(app)
      .get('/api/v1/food-items/99999999-9999-4999-8999-999999999999')
      .set('Authorization', authHeader);
    expect(res.status).toBe(404);
  });

  it('maps ConflictError to 409', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    errorHandler(new ConflictError('dup'), {} as never, { status } as never, vi.fn());
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ error: 'dup' });
  });
});
