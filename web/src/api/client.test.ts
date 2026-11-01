import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { onUnauthorized, session } from '@/auth/session';
import { createApiClient, isPublicAuthPath } from './client';

const BASE = 'http://localhost:3000/api/v1';

describe('api client 401 policy', () => {
  it('detects public auth paths by pathname', () => {
    expect(isPublicAuthPath('/api/v1/auth/login')).toBe(true);
    expect(isPublicAuthPath('/api/v1/auth/register')).toBe(true);
    expect(isPublicAuthPath('/api/v1/food-items/auth/login-notes')).toBe(false);
    expect(isPublicAuthPath('/api/v1/auth/me')).toBe(false);
  });

  it('emits unauthorized for a 401 with the current token', async () => {
    session.setToken('t1');
    server.use(http.get(`${BASE}/alerts/expiry`, () => new HttpResponse(null, { status: 401 })));
    const fn = vi.fn();
    const off = onUnauthorized(fn);
    await createApiClient(BASE)
      .GET('/alerts/expiry', {})
      .catch(() => {});
    off();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not emit when no token was sent', async () => {
    server.use(http.get(`${BASE}/alerts/expiry`, () => new HttpResponse(null, { status: 401 })));
    const fn = vi.fn();
    const off = onUnauthorized(fn);
    await createApiClient(BASE)
      .GET('/alerts/expiry', {})
      .catch(() => {});
    off();
    expect(fn).not.toHaveBeenCalled();
  });

  it('ignores a stale 401 after the token changed', async () => {
    session.setToken('old');
    server.use(
      http.get(`${BASE}/alerts/expiry`, () => {
        session.setToken('new');
        return new HttpResponse(null, { status: 401 });
      }),
    );
    const fn = vi.fn();
    const off = onUnauthorized(fn);
    await createApiClient(BASE)
      .GET('/alerts/expiry', {})
      .catch(() => {});
    off();
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not emit for 401 on /auth/login', async () => {
    session.setToken('t1');
    server.use(http.post(`${BASE}/auth/login`, () => new HttpResponse(null, { status: 401 })));
    const fn = vi.fn();
    const off = onUnauthorized(fn);
    await createApiClient(BASE)
      .POST('/auth/login', { body: { email: 'a@b.com', password: 'x' } })
      .catch(() => {});
    off();
    expect(fn).not.toHaveBeenCalled();
  });
});
