import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { API } from '@/test/fixtures';
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

  it('safeUrl only allows http(s)', () => {
    expect(safeUrl('javascript:x')).toBeUndefined();
    expect(safeUrl('https://a.com')).toBe('https://a.com/');
  });
});
