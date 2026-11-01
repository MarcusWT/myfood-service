import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { API, page } from '@/test/fixtures';
import { expectNoA11yViolations } from '@/test/axe';
import { FormError } from '@/components/form-error';
import { render } from '@testing-library/react';

beforeEach(() => {
  sessionStorage.setItem('myfood.token', 't');
  server.use(
    http.get(`${API}/auth/me`, () => HttpResponse.json({ id: 'u1', email: 'a@b.com' })),
    http.get(`${API}/food-items`, () => HttpResponse.json(page([]))),
    http.get(`${API}/alerts/expiry`, () => HttpResponse.json([])),
    http.get(`${API}/shopping/summary`, () =>
      HttpResponse.json({ generatedAt: null, totalItems: 0, byCategory: {} }),
    ),
  );
});

describe('app shell', () => {
  it('has a skip link, exactly one main and an active nav link', async () => {
    const { container } = renderApp('/alerts');
    await screen.findByRole('heading', { name: 'Expiry alerts' });
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getAllByRole('main')).toHaveLength(1);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Alerts' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Inventory' })).not.toHaveAttribute(
      'aria-current',
    );
    await expectNoA11yViolations(container);
  });

  it('user menu shows email and changes theme', async () => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    expect(await screen.findByText('a@b.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
  });

  it('user menu logs out', async () => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('mobile menu opens, navigates and closes', async () => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    const mobile = await screen.findByRole('navigation', { name: 'Mobile' });
    await userEvent.click(within(mobile).getByRole('link', { name: 'Shopping' }));
    expect(await screen.findByRole('heading', { name: 'Shopping summary' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull();
  });
});

describe('RouteAnnouncer', () => {
  it('sets the title, announces and focuses main on navigation', async () => {
    renderApp('/');
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(document.title).toBe('Dashboard · MYFood');
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Inventory',
      }),
    );
    await screen.findByRole('heading', { name: 'Inventory' });
    expect(document.title).toBe('Inventory · MYFood');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(await screen.findByText('Navigated to Inventory')).toBeInTheDocument();
  });

  it('does not move focus on first mount or search-param-only changes', async () => {
    renderApp('/alerts');
    await screen.findByRole('heading', { name: 'Expiry alerts' });
    expect(screen.getByRole('main')).not.toHaveFocus();
    await userEvent.selectOptions(screen.getByLabelText('Expiring within'), '7');
    expect(screen.getByRole('main')).not.toHaveFocus();
  });

  it('uses the fallback title for unknown routes', async () => {
    renderApp('/nope');
    await screen.findByRole('heading', { name: 'Page not found' });
    expect(document.title).toBe('Page not found · MYFood');
  });
});

describe('FormError', () => {
  it('renders an alert only when there is a message', () => {
    const { rerender } = render(<FormError id="x" />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<FormError id="x">Bad</FormError>);
    expect(screen.getByRole('alert')).toHaveTextContent('Bad');
  });
});
