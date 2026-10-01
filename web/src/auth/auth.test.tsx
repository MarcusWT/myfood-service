import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { page } from '@/test/fixtures';
import { safeNext } from './safeRedirect';

const API = 'http://localhost:3000/api/v1';
const user = { id: 'u1', email: 'a@b.com' };

describe('auth flow', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([]))),
      http.get(`${API}/alerts/expiry`, () => HttpResponse.json([])),
      http.get(`${API}/shopping/summary`, () =>
        HttpResponse.json({ generatedAt: null, totalItems: 0, byCategory: {} }),
      ),
    );
  });

  it('redirects unauthenticated users to login', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('logs in, stores token, and shows the home page', async () => {
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json({ token: 't1', user })));
    renderApp('/login?next=/');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Signed in as a@b.com')).toBeInTheDocument();
    expect(sessionStorage.getItem('myfood.token')).toBe('t1');
  });

  it('shows the server message on bad credentials (401) without clearing anything', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ error: 'Invalid email or password' }, { status: 401 }),
      ),
    );
    renderApp('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('shows a friendly message on 429', async () => {
    server.use(
      http.post(`${API}/auth/login`, () => HttpResponse.json({ error: 'x' }, { status: 429 })),
    );
    renderApp('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
  });

  it('maps 400 validation details to field errors on register', async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        HttpResponse.json(
          {
            error: 'Validation Error',
            details: [{ path: ['email'], message: 'Invalid email' }],
          },
          { status: 400 },
        ),
      ),
    );
    renderApp('/register');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Invalid email')).toBeInTheDocument();
  });

  it('validates a stored token via /auth/me on load', async () => {
    sessionStorage.setItem('myfood.token', 't1');
    server.use(http.get(`${API}/auth/me`, () => HttpResponse.json(user)));
    renderApp('/');
    expect(await screen.findByText('Signed in as a@b.com')).toBeInTheDocument();
  });

  it('clears an invalid stored token and redirects to login with a return URL', async () => {
    sessionStorage.setItem('myfood.token', 'bad');
    server.use(
      http.get(`${API}/auth/me`, () => HttpResponse.json({ error: 'nope' }, { status: 401 })),
    );
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem('myfood.token')).toBeNull());
  });

  it('logs out', async () => {
    sessionStorage.setItem('myfood.token', 't1');
    server.use(http.get(`${API}/auth/me`, () => HttpResponse.json(user)));
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(sessionStorage.getItem('myfood.token')).toBeNull();
  });
});

describe('safeNext', () => {
  it('only allows same-app relative paths', () => {
    expect(safeNext('/food?x=1')).toBe('/food?x=1');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});
