import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { API, makeItem, page } from '@/test/fixtures';
import { safeUrl } from './RecipesPage';

beforeEach(() => {
  sessionStorage.setItem('myfood.token', 't');
  server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ id: 'u1', email: 'a@b.com' })));
});

const recipe = (o = {}) => ({
  id: 1,
  title: 'Omelette',
  sourceUrl: 'https://example.com/o',
  readyInMinutes: 10,
  servings: 2,
  usedIngredients: [{ name: 'egg', amount: 2, unit: '' }],
  missedIngredients: [{ name: 'salt', amount: 1, unit: 'g' }],
  matchScore: 0.5,
  ...o,
});

describe('recipes', () => {
  it('does not fetch on load, fetches on click, and sanitises links', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/recipes/suggestions`, () => {
        calls++;
        return HttpResponse.json([
          recipe(),
          recipe({ id: 2, title: 'Bad', sourceUrl: 'javascript:alert(1)' }),
        ]);
      }),
    );
    renderApp('/recipes');
    await screen.findByRole('button', { name: 'Get suggestions' });
    expect(calls).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Get suggestions' }));
    const link = await screen.findByRole('link', { name: 'Omelette' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('link', { name: 'Bad' })).toBeNull();
    expect(screen.getByText('Bad')).toBeInTheDocument();
  });

  it.each([
    [429, /too many requests/i],
    [500, /currently unavailable/i],
  ])('shows distinct message for %i', async (status, text) => {
    server.use(
      http.get(`${API}/recipes/suggestions`, () => HttpResponse.json({ error: 'x' }, { status })),
    );
    renderApp('/recipes');
    await userEvent.click(await screen.findByRole('button', { name: 'Get suggestions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('shows empty state', async () => {
    server.use(http.get(`${API}/recipes/suggestions`, () => HttpResponse.json([])));
    renderApp('/recipes');
    await userEvent.click(await screen.findByRole('button', { name: 'Get suggestions' }));
    expect(await screen.findByText(/No recipes found/)).toBeInTheDocument();
  });

  it('drops cached suggestions after an inventory mutation', async () => {
    server.use(
      http.get(`${API}/recipes/suggestions`, () => HttpResponse.json([recipe()])),
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem({ name: 'Tea' })]))),
      http.delete(`${API}/food-items/:id`, () => new HttpResponse(null, { status: 204 })),
    );
    const { client } = renderApp('/recipes');
    await userEvent.click(await screen.findByRole('button', { name: 'Get suggestions' }));
    await screen.findByRole('link', { name: 'Omelette' });
    expect(client.getQueryCache().findAll({ queryKey: ['recipes'] })).toHaveLength(1);
    await userEvent.click(screen.getAllByRole('link', { name: /inventory/i })[0]!);
    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Tea' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(client.getQueryCache().findAll({ queryKey: ['recipes'] })).toHaveLength(0),
    );
    await userEvent.click(screen.getAllByRole('link', { name: /recipes/i })[0]!);
    expect(await screen.findByRole('button', { name: 'Get suggestions' })).toBeInTheDocument();
  });

  it('safeUrl only allows http(s)', () => {
    expect(safeUrl('javascript:x')).toBeUndefined();
    expect(safeUrl('https://a.com')).toBe('https://a.com/');
  });

  it('keeps cache across navigation and refreshes on demand', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/recipes/suggestions`, () => {
        calls++;
        return HttpResponse.json([recipe({ title: calls === 1 ? 'Omelette' : 'Pancakes' })]);
      }),
    );
    renderApp('/recipes');
    await userEvent.click(await screen.findByRole('button', { name: 'Get suggestions' }));
    await screen.findByRole('link', { name: 'Omelette' });
    await userEvent.click(screen.getAllByRole('link', { name: /dashboard/i })[0]!);
    await userEvent.click(screen.getAllByRole('link', { name: /recipes/i })[0]!);
    expect(await screen.findByRole('link', { name: 'Omelette' })).toBeInTheDocument();
    expect(calls).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh suggestions' }));
    expect(await screen.findByRole('link', { name: 'Pancakes' })).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('shows status while loading, badge lists and lazy safe images', async () => {
    server.use(
      http.get(`${API}/recipes/suggestions`, async () => {
        await delay(50);
        return HttpResponse.json([
          recipe({ imageUrl: 'https://example.com/i.png' }),
          recipe({ id: 2, title: 'NoImg', imageUrl: 'javascript:x' }),
        ]);
      }),
    );
    const { container } = renderApp('/recipes');
    await userEvent.click(await screen.findByRole('button', { name: 'Get suggestions' }));
    expect(await screen.findByText('Finding recipes…')).toBeInTheDocument();
    await screen.findByRole('link', { name: 'Omelette' });
    const have = screen.getAllByRole('list', { name: 'Ingredients you have' })[0]!;
    expect(within(have).getByText('Have: egg')).toBeInTheDocument();
    const missing = screen.getAllByRole('list', { name: 'Missing ingredients' })[0]!;
    expect(within(missing).getByText('Missing: salt')).toBeInTheDocument();
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute('loading', 'lazy');
  });

  it('keeps old results and shows an alert when a refresh fails', async () => {
    let fail = false;
    server.use(
      http.get(`${API}/recipes/suggestions`, () =>
        fail ? HttpResponse.json({ error: 'x' }, { status: 500 }) : HttpResponse.json([recipe()]),
      ),
    );
    renderApp('/recipes');
    await userEvent.click(await screen.findByRole('button', { name: 'Get suggestions' }));
    await screen.findByRole('link', { name: 'Omelette' });
    fail = true;
    await userEvent.click(screen.getByRole('button', { name: 'Refresh suggestions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/currently unavailable/i);
    expect(screen.getByRole('link', { name: 'Omelette' })).toBeInTheDocument();
  });
});
