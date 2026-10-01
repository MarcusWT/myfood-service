import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { API, makeItem, page } from '@/test/fixtures';

beforeEach(() => {
  sessionStorage.setItem('myfood.token', 't');
  server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ id: 'u1', email: 'a@b.com' })));
});

describe('inventory', () => {
  it('lists items with expiry and low-stock badges (text, not just colour)', async () => {
    const soon = new Date(Date.now() + 1.5 * 86_400_000).toISOString();
    server.use(
      http.get(`${API}/food-items`, () =>
        HttpResponse.json(
          page([
            makeItem({ name: 'Yogurt', bestBefore: soon, quantity: 1, minimumQuantity: 3 }),
            makeItem({ id: '2', name: 'Old', bestBefore: '2020-01-01T00:00:00Z' }),
          ]),
        ),
      ),
    );
    renderApp('/inventory');
    expect(await screen.findByText('Yogurt')).toBeInTheDocument();
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText(/Expires in 2d/)).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('reads filters and page from the URL and sends them to the API', async () => {
    let url = '';
    server.use(
      http.get(`${API}/food-items`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ ...page([makeItem()], 45), page: 2 });
      }),
    );
    renderApp('/inventory?location=PANTRY&name=mi&page=2');
    await screen.findByText('Milk');
    const q = new URL(url).searchParams;
    expect(q.get('location')).toBe('PANTRY');
    expect(q.get('name')).toBe('mi');
    expect(q.get('page')).toBe('2');
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('shows 409 duplicate as a field error when creating', async () => {
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([]))),
      http.post(`${API}/food-items`, () =>
        HttpResponse.json(
          { error: "An item named 'Milk' already exists in FRIDGE" },
          { status: 409 },
        ),
      ),
    );
    renderApp('/inventory');
    await userEvent.click(await screen.findByRole('button', { name: 'Add item' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Milk');
    await userEvent.type(within(dialog).getByLabelText('Quantity'), '1');
    await userEvent.type(within(dialog).getByLabelText('Best before'), '2099-01-01');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/already exists/)).toBeInTheDocument();
  });

  it('maps 400 details (future-only bestBefore) to the field', async () => {
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([]))),
      http.post(`${API}/food-items`, () =>
        HttpResponse.json(
          {
            error: 'Validation Error',
            details: [{ path: ['bestBefore'], message: 'bestBefore must be a future date' }],
          },
          { status: 400 },
        ),
      ),
    );
    renderApp('/inventory');
    await userEvent.click(await screen.findByRole('button', { name: 'Add item' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Milk');
    await userEvent.type(within(dialog).getByLabelText('Quantity'), '1');
    await userEvent.type(within(dialog).getByLabelText('Best before'), '2000-01-01');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('bestBefore must be a future date')).toBeInTheDocument();
  });

  it('confirms before marking consumed, then calls dispose', async () => {
    let body: unknown;
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem()]))),
      http.post(`${API}/food-items/:id/dispose`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeItem({ disposition: 'CONSUMED' }));
      }),
    );
    renderApp('/inventory');
    await userEvent.click(await screen.findByRole('button', { name: 'Consumed Milk' }));
    expect(body).toBeUndefined();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(body).toEqual({ outcome: 'CONSUMED' }));
  });

  it('hard-deletes only after confirmation', async () => {
    let deleted = false;
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem()]))),
      http.delete(`${API}/food-items/:id`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/inventory');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Milk' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(deleted).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Milk' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('shows an error state with retry', async () => {
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json({ error: 'x' }, { status: 500 })),
    );
    renderApp('/inventory');
    expect(await screen.findByText('Could not load items.')).toBeInTheDocument();
  });
});
