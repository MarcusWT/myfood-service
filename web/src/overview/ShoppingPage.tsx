import { useEffect, useId, useRef, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/auth/AuthProvider';
import { label } from '@/inventory/constants';
import { copyText } from '@/lib/clipboard';
import { PageHeader } from '@/shell/PageHeader';
import { useShoppingSummary } from './api';
import { ReasonBadge } from './ReasonBadge';
import { ShoppingListSkeleton } from './ShoppingListSkeleton';
import { buildShoppingText, dedupeEntries } from './shoppingText';
import { itemKey, useCheckedItems } from './useCheckedItems';

type CopyState = 'idle' | 'copied' | 'failed';

export function ShoppingPage() {
  const { data, isLoading, isError } = useShoppingSummary();
  const { user } = useAuth();
  const idPrefix = useId();
  const categories = data
    ? Object.entries(data.byCategory).map(([cat, l]) => [cat, dedupeEntries(l)] as const)
    : [];
  const allKeys = data ? categories.flatMap(([, l]) => l.map(itemKey)) : undefined;
  const { isChecked, toggle, clearAll } = useCheckedItems(user?.id, allKeys);
  const [copyRaw, setCopy] = useState<{ kind: CopyState; text: string }>({
    kind: 'idle',
    text: '',
  });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const total = allKeys?.length ?? 0;
  const checkedCount = allKeys?.filter(isChecked).length ?? 0;
  const byCategory = data?.byCategory ?? {};
  const unchecked = buildShoppingText(byCategory, isChecked, false);
  const text = unchecked || buildShoppingText(byCategory, isChecked, true);

  const copyState: CopyState = copyRaw.text === text ? copyRaw.kind : 'idle';
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    const ok = await copyText(text);
    setCopy({ kind: ok ? 'copied' : 'failed', text });
    timer.current = setTimeout(() => setCopy({ kind: 'idle', text }), 2000);
  }

  async function share() {
    try {
      await navigator.share({ text });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError'))
        setCopy({ kind: 'failed', text });
    }
  }

  const empty = !data?.totalItems;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shopping summary"
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={copy} disabled={empty}>
              Copy as text
            </Button>
            {canShare && (
              <Button variant="outline" size="sm" onClick={share} disabled={empty}>
                Share
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={empty}>
              Print
            </Button>
          </div>
        }
      />
      <p role="status" className="text-sm print:hidden">
        {copyState === 'copied' ? 'Copied to clipboard' : ''}
      </p>
      {copyState === 'failed' && (
        <p role="alert" className="text-sm text-destructive print:hidden">
          Could not copy
        </p>
      )}
      {isLoading && <ShoppingListSkeleton />}
      {isError && <p role="alert">Could not load shopping summary.</p>}
      {data && data.totalItems === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title="Nothing to buy"
          description="Everything you track is stocked up."
          action={{ label: 'View inventory', to: '/inventory', variant: 'outline' }}
        />
      )}
      {data && total > 0 && (
        <div className="flex items-center gap-3 text-sm print:hidden">
          <span>
            {checkedCount} of {total} checked
          </span>
          {checkedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear checked
            </Button>
          )}
        </div>
      )}
      {data &&
        categories.map(([cat, items]) => (
          <section key={cat}>
            <h2 className="mb-1 font-medium">{label(cat)}</h2>
            <ul className="space-y-1">
              {items.map((i, idx) => {
                const key = itemKey(i);
                const id = `${idPrefix}-${cat}-${idx}`;
                const checked = isChecked(key);
                return (
                  <li key={`${idx}-${key}`} className="flex flex-wrap items-center gap-2">
                    <input
                      id={id}
                      type="checkbox"
                      className="size-4"
                      checked={checked}
                      onChange={() => toggle(key)}
                    />
                    <label
                      htmlFor={id}
                      className={checked ? 'text-muted-foreground line-through' : undefined}
                    >
                      {i.name}
                    </label>
                    {i.currentQuantity !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        {i.currentQuantity}
                        {i.currentUnit ? ` ${label(i.currentUnit)}` : ''}
                      </span>
                    )}
                    <ReasonBadge reason={i.reason} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
