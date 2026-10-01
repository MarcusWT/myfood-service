import { act, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { API, makeItem, page } from '@/test/fixtures';
import { ErrorBoundary } from './ErrorBoundary';

beforeEach(() => {
  sessionStorage.setItem('myfood.token', 't');
  server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ id: 'u1', email: 'a@b.com' })));
});

describe('shell', () => {
  it('shows a 404 page', async () => {
    renderApp('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('error boundary renders fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('x');
    };
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('shows offline banner', async () => {
    server.use(http.get(`${API}/food-items`, () => HttpResponse.json(page([]))));
    renderApp('/inventory');
    await screen.findByText('Signed in as a@b.com');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });

  it('toggles dark mode', async () => {
    server.use(http.get(`${API}/alerts/expiry`, () => HttpResponse.json([])));
    renderApp('/alerts');
    const btn = await screen.findByRole('button', { name: 'Dark mode' });
    btn.click();
    await screen.findByRole('button', { name: 'Dark mode', pressed: true });
    expect(document.documentElement).toHaveClass('dark');
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it.each(['/inventory', '/alerts', '/shopping', '/recipes', '/login'])(
    'has no axe violations on %s',
    async (path) => {
      server.use(
        http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem()]))),
        http.get(`${API}/alerts/expiry`, () => HttpResponse.json([])),
        http.get(`${API}/shopping/summary`, () =>
          HttpResponse.json({ generatedAt: null, totalItems: 0, byCategory: {} }),
        ),
      );
      if (path === '/login') sessionStorage.clear();
      const { container } = renderApp(path);
      await screen.findAllByRole('heading');
      await new Promise((r) => setTimeout(r, 50));
      const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(res.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    },
  );
});
