import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '@/test/axe';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { API, makeItem, page } from '@/test/fixtures';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/auth/AuthProvider';
import { AppLayout } from '@/pages/AppLayout';
import { ErrorBoundary } from './ErrorBoundary';
import { OfflineBanner } from './OfflineBanner';

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
    await screen.findByRole('heading', { name: 'Inventory' });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
  });

  it('shows 404 with the attempted path and a way back', async () => {
    renderApp('/nope/x');
    expect(await screen.findByText('/nope/x')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  });

  it('shows a back-online message for 3s after reconnecting', async () => {
    vi.useFakeTimers();
    try {
      const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      render(<OfflineBanner />);
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(screen.getByRole('status')).toHaveTextContent('You are offline');
      onLine.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(screen.getByRole('status')).toHaveTextContent("You're back online");
      act(() => {
        vi.advanceTimersByTime(3100);
      });
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('error boundary has Try again and Reload page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    const Maybe = () => {
      if (fail) throw new Error('x');
      return <p>recovered</p>;
    };
    render(
      <ErrorBoundary>
        <Maybe />
      </ErrorBoundary>,
    );
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('shows a reload message for chunk load errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('Failed to fetch dynamically imported module: /x.js');
    };
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('A new version is available. Reload.');
  });

  it('route error boundary keeps the nav and resets on navigation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get(`${API}/alerts/expiry`, () => HttpResponse.json(null)),
      http.get(`${API}/food-items`, () => HttpResponse.json(page([]))),
    );
    const Boom = () => {
      throw new Error('x');
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/a']}>
          <AuthProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/a" element={<Boom />} />
                <Route path="/inventory" element={<p>inventory ok</p>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Inventory' }));
    expect(await screen.findByText('inventory ok')).toBeInTheDocument();
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
      const { container, client } = renderApp(path);
      await screen.findAllByRole('heading');
      await waitFor(() => expect(client.isFetching()).toBe(0));
      await expectNoA11yViolations(container);
    },
  );
});
