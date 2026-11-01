import { act, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '@/test/server';
import { renderApp } from '@/test/render';
import { API } from '@/test/fixtures';
import { buildShoppingText } from './shoppingText';
import { itemKey, useCheckedItems } from './useCheckedItems';

const milk = { name: 'Milk', category: 'DAIRY', reason: 'LOW_STOCK' };
const eggs = { name: 'Eggs', category: 'DAIRY', reason: 'EXPIRED' };

function serve(items = [milk], status = 200) {
  server.use(
    http.get(`${API}/shopping/summary`, () =>
      status === 200
        ? HttpResponse.json({
            generatedAt: null,
            totalItems: items.length,
            byCategory: items.length ? { DAIRY: items } : {},
          })
        : HttpResponse.json({ error: 'x' }, { status }),
    ),
  );
}

function login(id = 'u1') {
  sessionStorage.setItem('myfood.token', 't');
  server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ id, email: 'a@b.com' })));
}

beforeEach(() => {
  localStorage.clear();
  login();
});
afterEach(() => vi.useRealTimers());

describe('shopping page', () => {
  it('groups by category and copies text', async () => {
    serve();
    const user = userEvent.setup();
    renderApp('/shopping');
    expect(await screen.findByRole('heading', { name: 'Dairy' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('Dairy\n- Milk (Low stock)');
  });

  it('shows loading status then list, and empty state', async () => {
    server.use(
      http.get(`${API}/shopping/summary`, async () => {
        await delay(50);
        return HttpResponse.json({ generatedAt: null, totalItems: 0, byCategory: {} });
      }),
    );
    renderApp('/shopping');
    expect(await screen.findByText('Loading shopping list…')).toBeInTheDocument();
    expect(await screen.findByText('Nothing to buy')).toBeInTheDocument();
  });

  it('renders badges for all reasons with text', async () => {
    serve([milk, eggs, { name: 'Ham', category: 'DAIRY', reason: 'EXPIRING_SOON' }]);
    renderApp('/shopping');
    expect(await screen.findByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Expiring soon')).toBeInTheDocument();
  });

  it('persists checks per user and excludes checked from copy', async () => {
    serve([milk, eggs]);
    const user = userEvent.setup();
    renderApp('/shopping');
    await user.click(await screen.findByRole('checkbox', { name: 'Milk' }));
    expect(screen.getByText('1 of 2 checked')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('myfood.shopping.checked.u1')!)).toEqual([
      itemKey(milk),
    ]);
    await user.click(screen.getByRole('button', { name: 'Copy as text' }));
    expect(await navigator.clipboard.readText()).toBe('Dairy\n- Eggs (Expired)');
    await user.click(screen.getByRole('button', { name: 'Clear checked' }));
    expect(screen.queryByRole('button', { name: 'Clear checked' })).toBeNull();
  });

  it('does not show other users checks', async () => {
    localStorage.setItem('myfood.shopping.checked.u1', JSON.stringify([itemKey(milk)]));
    login('u2');
    serve();
    renderApp('/shopping');
    expect(await screen.findByRole('checkbox', { name: 'Milk' })).not.toBeChecked();
  });

  it('prunes stale keys after load but not on error', async () => {
    localStorage.setItem('myfood.shopping.checked.u1', JSON.stringify([itemKey(milk), 'gone']));
    serve([milk]);
    const { unmount } = renderApp('/shopping');
    await screen.findByRole('checkbox', { name: 'Milk' });
    expect(JSON.parse(localStorage.getItem('myfood.shopping.checked.u1')!)).toEqual([
      itemKey(milk),
    ]);
    unmount();

    localStorage.setItem('myfood.shopping.checked.u1', JSON.stringify(['gone']));
    serve([], 500);
    renderApp('/shopping');
    await screen.findByText('Could not load shopping summary.');
    expect(JSON.parse(localStorage.getItem('myfood.shopping.checked.u1')!)).toEqual(['gone']);
  });

  it('survives corrupt JSON and throwing setItem', async () => {
    localStorage.setItem('myfood.shopping.checked.u1', '{nope');
    serve();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    renderApp('/shopping');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Milk' }));
    expect(screen.getByRole('checkbox', { name: 'Milk' })).toBeChecked();
    spy.mockRestore();
  });

  it('Copied message resets after a timeout and on toggle', async () => {
    serve([milk, eggs]);
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: write },
      configurable: true,
    });
    renderApp('/shopping');
    await screen.findByRole('checkbox', { name: 'Milk' });
    const copyBtn = await screen.findByRole('button', { name: 'Copy as text' });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(async () => copyBtn.click());
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.queryByText('Copied to clipboard')).toBeNull();
    await act(async () => copyBtn.click());
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument();
    await act(async () => screen.getByRole('checkbox', { name: 'Milk' }).click());
    expect(screen.queryByText('Copied to clipboard')).toBeNull();
  });

  it('shows an error when the clipboard rejects', async () => {
    serve();
    renderApp('/shopping');
    const btn = await screen.findByRole('button', { name: 'Copy as text' });
    const spy = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('no'));
    await userEvent.click(btn);
    expect(await screen.findByText('Could not copy')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('prints and shares when supported', async () => {
    serve();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const share = vi.fn().mockRejectedValue(new DOMException('x', 'AbortError'));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    renderApp('/shopping');
    await userEvent.click(await screen.findByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith({ text: 'Dairy\n- Milk (Low stock)' });
    expect(screen.queryByText('Could not copy')).toBeNull();
    delete (navigator as { share?: unknown }).share;
  });
});

describe('units', () => {
  it('itemKey normalises', () => {
    expect(itemKey({ name: ' Milk ', category: 'DAIRY', reason: 'LOW_STOCK' })).toBe(
      'DAIRY|milk|LOW_STOCK',
    );
  });

  it('buildShoppingText filters checked', () => {
    const by = { DAIRY: [milk, eggs] };
    const checked = (k: string) => k === itemKey(milk);
    expect(buildShoppingText(by, checked, false)).toBe('Dairy\n- Eggs (Expired)');
    expect(buildShoppingText(by, checked, true)).toBe(
      'Dairy\n- Milk (Low stock)\n- Eggs (Expired)',
    );
  });

  it('dedupes identical entries and gives unique, label-associated ids to odd names', async () => {
    const weird = { name: 'Mac | cheese x', category: 'DAIRY', reason: 'LOW_STOCK' };
    serve([milk, milk, weird]);
    renderApp('/shopping');
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(new Set(boxes.map((b) => b.id)).size).toBe(2);
    await userEvent.click(screen.getByLabelText('Mac | cheese x'));
    expect(screen.getByLabelText('Mac | cheese x')).toBeChecked();
    expect(screen.getByLabelText('Milk')).not.toBeChecked();
    expect(buildShoppingText({ DAIRY: [milk, milk] }, () => false, false)).toBe(
      'Dairy\n- Milk (Low stock)',
    );
  });

  it('useCheckedItems prunes stale keys with a single write', () => {
    localStorage.setItem('myfood.shopping.checked.u1', JSON.stringify(['a', 'gone']));
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const { result, rerender } = renderHook(() => useCheckedItems('u1', ['a']));
    rerender();
    rerender();
    expect(result.current.isChecked('gone')).toBe(false);
    expect(result.current.isChecked('a')).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('myfood.shopping.checked.u1')).toBe('["a"]');
    spy.mockRestore();
  });

  it('useCheckedItems toggles, persists, is in-memory without user', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id?: string }) => useCheckedItems(id, undefined),
      { initialProps: { id: 'u1' as string | undefined } },
    );
    act(() => result.current.toggle('k'));
    expect(result.current.isChecked('k')).toBe(true);
    expect(localStorage.getItem('myfood.shopping.checked.u1')).toBe('["k"]');
    rerender({ id: undefined });
    expect(result.current.isChecked('k')).toBe(false);
    act(() => result.current.toggle('z'));
    expect(result.current.isChecked('z')).toBe(true);
    expect(localStorage.getItem('myfood.shopping.checked.undefined')).toBeNull();
  });
});
