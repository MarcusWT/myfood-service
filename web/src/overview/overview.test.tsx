import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { API, makeItem } from '@/test/fixtures';
import { lowStockEntries } from './api';

beforeEach(() => {
  sessionStorage.setItem('myfood.token', 't');
  server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ id: 'u1', email: 'a@b.com' })));
});

const summary = (byCategory = {}, totalItems = 0) => ({
  generatedAt: null,
  totalItems,
  byCategory,
});
const entry = (name: string, reason = 'LOW_STOCK') => ({ name, category: 'DAIRY', reason });

describe('alerts', () => {
  it('sends withinDays and shows alerts with text status', async () => {
    let url = '';
    server.use(
      http.get(`${API}/alerts/expiry`, ({ request }) => {
        url = request.url;
        return HttpResponse.json([
          { item: makeItem({ name: 'Yogurt' }), daysUntilExpiry: 2, status: 'WARNING' },
        ]);
      }),
    );
    renderApp('/alerts?withinDays=7');
    expect(await screen.findByText('Yogurt')).toBeInTheDocument();
    expect(screen.getByText('Expires in 2d')).toBeInTheDocument();
    expect(url).toContain('withinDays=7');
  });

  it('shows a loading status then the list', async () => {
    server.use(
      http.get(`${API}/alerts/expiry`, async () => {
        await delay(50);
        return HttpResponse.json([
          { item: makeItem({ name: 'Yogurt' }), daysUntilExpiry: 2, status: 'WARNING' },
        ]);
      }),
    );
    renderApp('/alerts');
    expect(await screen.findByText('Loading alerts…')).toBeInTheDocument();
    expect(await screen.findByText('Yogurt')).toBeInTheDocument();
    expect(screen.queryByText('Loading alerts…')).toBeNull();
  });

  it('shows empty state', async () => {
    server.use(http.get(`${API}/alerts/expiry`, () => HttpResponse.json([])));
    renderApp('/alerts?withinDays=7');
    expect(await screen.findByText('Nothing is expiring')).toBeInTheDocument();
    expect(screen.getByText('No items expire within 7 days.')).toBeInTheDocument();
  });
});

describe('dashboard', () => {
  function handlers(over: { alerts?: unknown; shopping?: unknown } = {}) {
    const urls: URL[] = [];
    server.use(
      http.get(`${API}/food-items`, ({ request }) => {
        const u = new URL(request.url);
        urls.push(u);
        const total = { FRIDGE: 2, FREEZER: 1, PANTRY: 2 }[u.searchParams.get('location') ?? ''];
        return HttpResponse.json({ data: [makeItem()], total, page: 1, limit: 1 });
      }),
      http.get(`${API}/alerts/expiry`, () => HttpResponse.json(over.alerts ?? [])),
      http.get(`${API}/shopping/summary`, () => HttpResponse.json(over.shopping ?? summary())),
    );
    return urls;
  }

  it('shows dashboard counts from per-location totals', async () => {
    const urls = handlers({ shopping: summary({}, 2) });
    renderApp('/');
    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(await screen.findByText('2', { selector: 'span.text-2xl' })).toBeInTheDocument();
    expect(urls.every((u) => u.searchParams.get('limit') === '1')).toBe(true);
    expect(screen.getByRole('link', { name: /Fridge/ })).toHaveAttribute(
      'href',
      '/inventory?location=FRIDGE',
    );
  });

  it('shows no placeholder dash while pending', async () => {
    server.use(
      http.get(`${API}/food-items`, async () => {
        await delay(100);
        return HttpResponse.json({ data: [], total: 1, page: 1, limit: 1 });
      }),
      http.get(`${API}/alerts/expiry`, () => HttpResponse.json([])),
      http.get(`${API}/shopping/summary`, () => HttpResponse.json(summary())),
    );
    renderApp('/');
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.queryByText('–')).toBeNull();
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('lists only LOW_STOCK entries, capped at 5, and links alerts to inventory', async () => {
    handlers({
      alerts: [{ item: makeItem({ name: 'Mi lk' }), daysUntilExpiry: 1, status: 'CRITICAL' }],
      shopping: summary(
        {
          DAIRY: [
            entry('Butter'),
            entry('Old', 'EXPIRED'),
            ...['a', 'b', 'c', 'd', 'e'].map((n) => entry(n)),
          ],
        },
        7,
      ),
    });
    renderApp('/');
    expect(await screen.findByText('Butter')).toBeInTheDocument();
    expect(screen.queryByText('Old')).toBeNull();
    expect(screen.queryByText('e')).toBeNull();
    expect(screen.getByRole('link', { name: /See all 6/ })).toHaveAttribute('href', '/shopping');
    expect(screen.getByRole('link', { name: /Mi lk/ })).toHaveAttribute(
      'href',
      '/inventory?name=Mi%20lk',
    );
  });

  it('shows an alerts error with retry while other sections render', async () => {
    handlers({ shopping: summary({}, 2) });
    let fail = true;
    server.use(
      http.get(`${API}/alerts/expiry`, () =>
        fail ? HttpResponse.json({ error: 'x' }, { status: 500 }) : HttpResponse.json([]),
      ),
    );
    renderApp('/');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load alerts.');
    expect(await screen.findByText('5')).toBeInTheDocument();
    fail = false;
    await userEvent.click(
      within(alert.parentElement as HTMLElement).getByRole('button', { name: 'Retry' }),
    );
    expect(await screen.findByText('Nothing expiring soon')).toBeInTheDocument();
  });

  it('does not show NaN when counts fail', async () => {
    handlers();
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json({ error: 'x' }, { status: 500 })),
    );
    renderApp('/');
    expect(await screen.findByText('Could not load location counts.')).toBeInTheDocument();
    expect(screen.queryByText('NaN')).toBeNull();
  });

  it('one failed location count does not blank the others', async () => {
    handlers();
    server.use(
      http.get(`${API}/food-items`, ({ request }) => {
        const loc = new URL(request.url).searchParams.get('location');
        if (loc === 'FREEZER') return HttpResponse.json({ error: 'x' }, { status: 500 });
        return HttpResponse.json({ data: [], total: loc === 'FRIDGE' ? 2 : 3, page: 1, limit: 1 });
      }),
    );
    renderApp('/');
    const fridge = await screen.findByRole('link', { name: /Fridge/ });
    await waitFor(() => expect(fridge).toHaveTextContent('2'));
    expect(screen.getByRole('link', { name: /Pantry/ })).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /Freezer/ })).toHaveTextContent('–');
  });

  it('opens the add item dialog', async () => {
    handlers();
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /Add item/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows empty states once loaded', async () => {
    handlers();
    renderApp('/');
    expect(await screen.findByText('Nothing expiring soon')).toBeInTheDocument();
    expect(await screen.findByText('Nothing running low')).toBeInTheDocument();
  });

  it('lowStockEntries flattens and filters', () => {
    expect(lowStockEntries(undefined)).toEqual([]);
    expect(lowStockEntries(summary())).toEqual([]);
    const s = summary({ A: [entry('x'), entry('y', 'EXPIRED')], B: [entry('z')] });
    expect(lowStockEntries(s as never).map((e) => e.name)).toEqual(['x', 'z']);
  });
});
