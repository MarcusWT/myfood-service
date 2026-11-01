import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { toApiError } from './errors';
import { emitUnauthorized, session } from '@/auth/session';

// Endpoints where a 401 means "bad credentials", not "session expired".
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register'];

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.endsWith(p));
}

// Token each request was sent with, so a late 401 for an old session can't log out a new one.
const sentTokens = new WeakMap<Request, string>();

export const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = session.getToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
      sentTokens.set(request, token);
    }
    return request;
  },
  async onResponse({ request, response }) {
    if (response.ok) return response;
    if (
      response.status === 401 &&
      !isPublicAuthPath(new URL(request.url).pathname) &&
      sentTokens.get(request) !== undefined &&
      sentTokens.get(request) === session.getToken()
    ) {
      emitUnauthorized();
    }
    throw await toApiError(response);
  },
};

export function createApiClient(baseUrl = '') {
  const client = createClient<paths>({
    baseUrl,
    // Resolve fetch lazily so test-time patches (MSW) are honoured.
    fetch: (request) => globalThis.fetch(request),
  });
  client.use(authMiddleware);
  return client;
}

// Schema paths are relative to the server URL `/api/v1`; same-origin in prod, proxied in dev.
export const api = createApiClient(`${window.location.origin}/api/v1`);
