import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PAGE_SIZE, useFoodItems } from './api';
import { CATEGORIES, LOCATIONS, label } from './constants';
import { ItemFormDialog } from './ItemFormDialog';
import { ItemRow } from './ItemRow';

const selectClass = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm';

export function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const location = params.get('location') ?? '';
  const category = params.get('category') ?? '';
  const name = params.get('name') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(name);
  const [adding, setAdding] = useState(false);

  function setParam(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  }

  // Debounced search; resets to page 1.
  useEffect(() => {
    if (search === name) return;
    const t = setTimeout(() => setParam({ name: search.trim(), page: '' }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isPending, isError, refetch } = useFoodItems({ location, category, name, page });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <Button onClick={() => setAdding(true)}>Add item</Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="search">Search</Label>
          <Input id="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-location">Location</Label>
          <select
            id="f-location"
            className={selectClass}
            value={location}
            onChange={(e) => setParam({ location: e.target.value, page: '' })}
          >
            <option value="">All</option>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {label(l)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-category">Category</Label>
          <select
            id="f-category"
            className={selectClass}
            value={category}
            onChange={(e) => setParam({ category: e.target.value, page: '' })}
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPending && <p role="status">Loading…</p>}
      {isError && (
        <div role="alert">
          <p>Could not load items.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}
      {data && data.data.length === 0 && <p>No items found.</p>}
      {data && data.data.length > 0 && (
        <ul className="space-y-2">
          {data.data.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
      {data && totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setParam({ page: String(page + 1) })}
          >
            Next
          </Button>
        </nav>
      )}
      {adding && <ItemFormDialog open onOpenChange={setAdding} />}
    </main>
  );
}
