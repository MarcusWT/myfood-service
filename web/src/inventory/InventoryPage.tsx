import { useEffect, useState } from 'react';
import { Package, SearchX, X } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/shell/PageHeader';
import { PAGE_SIZE, useFoodItems } from './api';
import { CATEGORIES, LOCATIONS, label } from './constants';
import { InventoryListSkeleton } from './InventoryListSkeleton';
import { ItemFormDialog } from './ItemFormDialog';
import { ItemList } from './ItemList';
import { useInventoryFilters } from './useInventoryFilters';

export function InventoryPage() {
  const f = useInventoryFilters();
  const [adding, setAdding] = useState(false);
  const { data, isPending, isError, isPlaceholderData, refetch } = useFoodItems(f.filters);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const total = data?.total;
  const outOfRange =
    !!data && !isPlaceholderData && data.total > 0 && data.data.length === 0 && f.filters.page > 1;
  const { setPage } = f;
  useEffect(() => {
    if (outOfRange) setPage(totalPages);
  }, [outOfRange, totalPages, setPage]);
  const countText =
    total === undefined
      ? ''
      : `${total} ${total === 1 ? 'item' : 'items'}${f.hasActiveFilters ? ' matching filters' : ''}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        actions={<Button onClick={() => setAdding(true)}>Add item</Button>}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="search">Search</Label>
          <Input id="search" value={f.search} onChange={(e) => f.setSearch(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-location">Location</Label>
          <NativeSelect
            id="f-location"
            value={f.filters.location}
            onChange={(e) => f.setLocation(e.target.value)}
          >
            <option value="">All</option>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {label(l)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-category">Category</Label>
          <NativeSelect
            id="f-category"
            value={f.filters.category}
            onChange={(e) => f.setCategory(e.target.value)}
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </NativeSelect>
        </div>
        {f.hasActiveFilters && (
          <Button variant="ghost" onClick={f.clear}>
            Clear filters
          </Button>
        )}
      </div>

      {f.chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {f.chips.map((c) => (
            <Button
              key={c.key}
              size="sm"
              variant="outline"
              aria-label={`Remove filter: ${c.label}`}
              onClick={c.remove}
            >
              {c.label} <X aria-hidden />
            </Button>
          ))}
        </div>
      )}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {countText}
      </p>

      {isPending && <InventoryListSkeleton />}
      {isError && (
        <div role="alert">
          <p>Could not load items.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}
      {data &&
        !outOfRange &&
        data.data.length === 0 &&
        (f.hasActiveFilters ? (
          <EmptyState
            icon={SearchX}
            title="No items match your filters"
            action={{ label: 'Clear filters', onClick: f.clear, variant: 'outline' }}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="Your inventory is empty"
            action={{ label: 'Add your first item', onClick: () => setAdding(true) }}
          />
        ))}
      {data && data.data.length > 0 && (
        <div
          aria-busy={isPlaceholderData || undefined}
          className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}
        >
          <ItemList items={data.data} />
        </div>
      )}
      {data && totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <Pagination
            page={f.filters.page}
            totalPages={totalPages}
            onPageChange={f.setPage}
            disabled={isPlaceholderData}
          />
          <span className="text-sm">
            Page {f.filters.page} of {totalPages}
          </span>
        </div>
      )}
      <ItemFormDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
