import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { API, makeItem } from '@/test/fixtures';

beforeEach(() => {
  sessionStorage.setItem('myfood.token', 't');
  server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ id: 'u1', email: 'a@b.com' })));
});

describe('overview', () => {
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

  it('groups shopping by category and copies text', async () => {
    server.use(
      http.get(`${API}/shopping/summary`, () =>
        HttpResponse.json({
          generatedAt: null,
          totalItems: 1,
          byCategory: { DAIRY: [{ name: 'Milk', category: 'DAIRY', reason: 'LOW_STOCK' }] },
        }),
      ),
    );
    const user = userEvent.setup();
    renderApp('/shopping');
    expect(await screen.findByRole('heading', { name: 'Dairy' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('Dairy\n- Milk (Low stock)');
  });

  it('shows dashboard counts', async () => {
    server.use(
      http.get(`${API}/food-items`, () =>
        HttpResponse.json({ data: [makeItem()], total: 5, page: 1, limit: 20 }),
      ),
      http.get(`${API}/alerts/expiry`, () => HttpResponse.json([])),
      http.get(`${API}/shopping/summary`, () =>
        HttpResponse.json({ generatedAt: null, totalItems: 2, byCategory: {} }),
      ),
    );
    renderApp('/');
    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(await screen.findByText('2')).toBeInTheDocument();
  });
});
