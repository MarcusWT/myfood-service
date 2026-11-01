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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function toastFor(text: string) {
  const el = (await screen.findAllByText(text))[0]!;
  return within(el.closest('li')!);
}

async function openMenuItem(name: string, item: string) {
  await userEvent.click(await screen.findByRole('button', { name: `More actions for ${name}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
}

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
    expect(await screen.findByText('Yogurt', { selector: 'p' })).toBeInTheDocument();
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
    await screen.findByText('Milk', { selector: 'p' });
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

  it('omits untouched notes/minimumQuantity when editing', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(`${API}/food-items`, () =>
        HttpResponse.json(page([makeItem({ notes: 'old', minimumQuantity: 2 })])),
      ),
      http.patch(`${API}/food-items/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeItem());
      }),
    );
    renderApp('/inventory');
    await openMenuItem('Milk', 'Edit');
    const dialog = await screen.findByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Oat milk');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ name: 'Oat milk' });
    expect(body).not.toHaveProperty('notes');
    expect(body).not.toHaveProperty('minimumQuantity');
  });

  it('sends null for emptied notes/minimumQuantity when editing', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(`${API}/food-items`, () =>
        HttpResponse.json(page([makeItem({ notes: 'old', minimumQuantity: 2 })])),
      ),
      http.patch(`${API}/food-items/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeItem());
      }),
    );
    renderApp('/inventory');
    await openMenuItem('Milk', 'Edit');
    const dialog = await screen.findByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('Notes'));
    await userEvent.clear(within(dialog).getByLabelText('Low-stock threshold'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ notes: null, minimumQuantity: null });
    expect(body).not.toHaveProperty('bestBefore');
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
    await openMenuItem('Milk', 'Remove');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(deleted).toBe(false);
    await openMenuItem('Milk', 'Remove');
    expect(await screen.findByText('Remove permanently?')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('shows an error state with retry', async () => {
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json({ error: 'x' }, { status: 500 })),
    );
    renderApp('/inventory');
    expect(await screen.findByText('Could not load items.')).toBeInTheDocument();
  });

  it('uses one dialog per list, label-in-name Consumed button, time and expired accent', async () => {
    server.use(
      http.get(`${API}/food-items`, () =>
        HttpResponse.json(
          page([
            makeItem({ id: '1', name: 'Old', bestBefore: '2020-01-01T00:00:00Z' }),
            makeItem({ id: '2', name: 'Fresh' }),
          ]),
        ),
      ),
    );
    renderApp('/inventory');
    const old = (await screen.findByText('Old', { selector: 'p' })).closest('li')!;
    expect(old).toHaveClass('border-l-destructive');
    expect(old.querySelector('time')).toHaveAttribute('datetime', '2020-01-01T00:00:00Z');
    expect(within(old).getByRole('button', { name: 'Consumed Old' })).toHaveTextContent(
      'Consumed Old',
    );
    await openMenuItem('Fresh', 'Edit');
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
  });

  it('focuses the name field when the add dialog opens', async () => {
    server.use(http.get(`${API}/food-items`, () => HttpResponse.json(page([]))));
    renderApp('/inventory');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add item' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Name')).toHaveFocus());
  });

  it('create shows a success toast and closes the dialog', async () => {
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([]))),
      http.post(`${API}/food-items`, () =>
        HttpResponse.json(makeItem({ name: 'Eggs' }), { status: 201 }),
      ),
    );
    renderApp('/inventory');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add item' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Eggs');
    await userEvent.type(within(dialog).getByLabelText('Quantity'), '6');
    await userEvent.click(within(dialog).getByRole('button', { name: '+1 week' }));
    expect(within(dialog).getByLabelText('Best before')).not.toHaveValue('');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Added "Eggs"'))[0]).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a notes counter without dirtying notes', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem()]))),
      http.patch(`${API}/food-items/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeItem());
      }),
    );
    renderApp('/inventory');
    await openMenuItem('Milk', 'Edit');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('0/500')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: '+3 days' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toHaveProperty('bestBefore');
    expect(body).not.toHaveProperty('notes');
  });

  it('update success toast offers Undo that restores previous values', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem({ name: 'Butter' })]))),
      http.patch(`${API}/food-items/:id`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(makeItem({ name: 'Butter' }));
      }),
    );
    renderApp('/inventory');
    await openMenuItem('Butter', 'Edit');
    const dialog = await screen.findByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'OatButter');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    const toast = await toastFor('Updated "OatButter"');
    await userEvent.click(toast.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({ name: 'Butter' });
  });

  it('update 409 stays inline with no success toast', async () => {
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem({ name: 'Cheese' })]))),
      http.patch(`${API}/food-items/:id`, () =>
        HttpResponse.json({ error: 'Already exists' }, { status: 409 }),
      ),
    );
    renderApp('/inventory');
    await openMenuItem('Cheese', 'Edit');
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'x');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Already exists')).toBeInTheDocument();
    expect(screen.queryByText('Updated "Cheesex"')).not.toBeInTheDocument();
    expect(screen.getAllByText('Already exists')).toHaveLength(1);
  });

  it('dispose toasts without Undo', async () => {
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem({ name: 'Jam' })]))),
      http.post(`${API}/food-items/:id/dispose`, () =>
        HttpResponse.json(makeItem({ name: 'Jam' })),
      ),
    );
    renderApp('/inventory');
    await userEvent.click(await screen.findByRole('button', { name: 'Consumed Jam' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    const toast = await toastFor('Marked "Jam" as consumed');
    expect(toast.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('remove toasts with Undo re-creating the item; failed undo toasts an error', async () => {
    let posted: Record<string, unknown> | undefined;
    let fail = false;
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem({ name: 'Rice' })]))),
      http.delete(`${API}/food-items/:id`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${API}/food-items`, async ({ request }) => {
        if (fail) return HttpResponse.json({ error: 'Undo broke' }, { status: 409 });
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeItem({ name: 'Rice' }), { status: 201 });
      }),
    );
    renderApp('/inventory');
    await openMenuItem('Rice', 'Remove');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const first = await toastFor('Removed "Rice"');
    await userEvent.click(first.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(posted).toMatchObject({ name: 'Rice', quantity: 2 }));

    fail = true;
    await openMenuItem('Rice', 'Remove');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(async () => {
      const els = await screen.findAllByText('Removed "Rice"');
      expect(els.length).toBeGreaterThan(1);
    });
    const els = await screen.findAllByText('Removed "Rice"');
    const buttons = els.map((e) => within(e.closest('li')!).getByRole('button', { name: 'Undo' }));
    await userEvent.click(buttons[0]!);
    expect((await screen.findAllByText('Undo broke'))[0]).toBeInTheDocument();
  });

  it('failing dispose toasts and leaves no stale role=alert on the row', async () => {
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem({ name: 'Soup' })]))),
      http.post(`${API}/food-items/:id/dispose`, () =>
        HttpResponse.json({ error: 'Server exploded' }, { status: 500 }),
      ),
    );
    renderApp('/inventory');
    await userEvent.click(await screen.findByRole('button', { name: 'Consumed Soup' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect((await screen.findAllByText('Server exploded'))[0]).toBeInTheDocument();
    const li = screen.getByText('Soup', { selector: 'p' }).closest('li')!;
    expect(within(li).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('double-clicking confirm hits the server once', async () => {
    let calls = 0;
    const gate = deferred();
    server.use(
      http.get(`${API}/food-items`, () => HttpResponse.json(page([makeItem({ name: 'Tea' })]))),
      http.post(`${API}/food-items/:id/dispose`, async () => {
        calls++;
        await gate.promise;
        return HttpResponse.json(makeItem({ name: 'Tea' }));
      }),
    );
    renderApp('/inventory');
    await userEvent.click(await screen.findByRole('button', { name: 'Consumed Tea' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm' });
    await userEvent.dblClick(confirm);
    await waitFor(() => expect(calls).toBe(1));
    gate.resolve();
    await toastFor('Marked "Tea" as consumed');
    expect(calls).toBe(1);
  });

  it('redirects an out-of-range page to the last page instead of the empty state', async () => {
    const pages: number[] = [];
    server.use(
      http.get(`${API}/food-items`, ({ request }) => {
        const p = Number(new URL(request.url).searchParams.get('page'));
        pages.push(p);
        return HttpResponse.json({
          ...page(p > 3 ? [] : [makeItem({ name: 'Tea' })], 45),
          page: p,
        });
      }),
    );
    renderApp('/inventory?page=99');
    expect(await screen.findByText('Tea', { selector: 'p' })).toBeInTheDocument();
    expect(pages).toContain(3);
    expect(screen.queryByText('Your inventory is empty')).toBeNull();
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
  });

  it('shows an edited item with null minimumQuantity as an empty, clean field', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.get(`${API}/food-items`, () =>
        HttpResponse.json(page([makeItem({ minimumQuantity: null as unknown as number })])),
      ),
      http.patch(`${API}/food-items/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeItem());
      }),
    );
    renderApp('/inventory');
    await openMenuItem('Milk', 'Edit');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Low-stock threshold')).toHaveValue(null);
    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Oat milk');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).toBeDefined());
    expect(body).not.toHaveProperty('minimumQuantity');
  });

  describe('filters', () => {
    it('typing debounces into the URL/API with page reset, shows chips and count', async () => {
      const urls: string[] = [];
      server.use(
        http.get(`${API}/food-items`, ({ request }) => {
          urls.push(request.url);
          return HttpResponse.json(page([makeItem({ name: 'Tea' })], 1));
        }),
      );
      renderApp('/inventory?page=3');
      await screen.findByText('Tea', { selector: 'p' });
      await userEvent.type(screen.getByLabelText('Search'), 'oat');
      await waitFor(() =>
        expect(new URL(urls[urls.length - 1]!).searchParams.get('name')).toBe('oat'),
      );
      const q = new URL(urls[urls.length - 1]!).searchParams;
      expect(q.get('page')).toBe('1');
      expect(await screen.findByText('1 item matching filters')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Search: oat' }));
      await waitFor(() =>
        expect(new URL(urls[urls.length - 1]!).searchParams.get('name')).toBeNull(),
      );
      expect(screen.getByLabelText('Search')).toHaveValue('');
    });

    it('chips, clear filters, and page navigation', async () => {
      const urls: string[] = [];
      server.use(
        http.get(`${API}/food-items`, ({ request }) => {
          urls.push(request.url);
          return HttpResponse.json(page([makeItem({ name: 'Tea' })], 100));
        }),
      );
      renderApp('/inventory?location=PANTRY&category=DAIRY');
      await screen.findByText('Tea', { selector: 'p' });
      await userEvent.click(
        screen.getByRole('button', { name: 'Remove filter: Location: Pantry' }),
      );
      await waitFor(() =>
        expect(new URL(urls[urls.length - 1]!).searchParams.get('location')).toBeNull(),
      );
      expect(new URL(urls[urls.length - 1]!).searchParams.get('category')).toBe('DAIRY');
      await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));
      await waitFor(() =>
        expect(new URL(urls[urls.length - 1]!).searchParams.get('page')).toBe('3'),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      await waitFor(() =>
        expect(new URL(urls[urls.length - 1]!).searchParams.get('category')).toBeNull(),
      );
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
      expect(screen.getByText('100 items')).toBeInTheDocument();
    });
  });

  describe('loading and empty states', () => {
    it('shows a loading status first, then items', async () => {
      const gate = deferred();
      renderApp('/inventory');
      server.use(
        http.get(`${API}/food-items`, async () => {
          await gate.promise;
          return HttpResponse.json(page([makeItem({ name: 'Tea' })]));
        }),
      );
      expect(await screen.findByText('Loading items…')).toBeInTheDocument();
      gate.resolve();
      expect(await screen.findByText('Tea', { selector: 'p' })).toBeInTheDocument();
      expect(screen.queryByText('Loading items…')).not.toBeInTheDocument();
    });

    it('keeps the previous page visible while the next page loads', async () => {
      const gate = deferred();
      server.use(
        http.get(`${API}/food-items`, async ({ request }) => {
          const p = Number(new URL(request.url).searchParams.get('page'));
          if (p === 2) await gate.promise;
          return HttpResponse.json({
            ...page([makeItem({ name: p === 2 ? 'Page two item' : 'Page one item' })], 45),
            page: p,
          });
        }),
      );
      renderApp('/inventory');
      await screen.findByText('Page one item', { selector: 'p' });
      await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
      expect(screen.getByText('Page one item', { selector: 'p' })).toBeInTheDocument();
      expect(screen.queryByText('Loading items…')).not.toBeInTheDocument();
      gate.resolve();
      expect(await screen.findByText('Page two item', { selector: 'p' })).toBeInTheDocument();
    });

    it('empty inventory CTA opens the add dialog', async () => {
      server.use(http.get(`${API}/food-items`, () => HttpResponse.json(page([]))));
      renderApp('/inventory');
      expect(await screen.findByText('Your inventory is empty')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Add your first item' }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('filtered empty state CTA clears filters', async () => {
      server.use(http.get(`${API}/food-items`, () => HttpResponse.json(page([]))));
      renderApp('/inventory?location=PANTRY');
      expect(await screen.findByText('No items match your filters')).toBeInTheDocument();
      const buttons = screen.getAllByRole('button', { name: 'Clear filters' });
      await userEvent.click(buttons[buttons.length - 1]!);
      expect(await screen.findByText('Your inventory is empty')).toBeInTheDocument();
    });
  });
});
