import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { label } from '@/inventory/constants';
import { useShoppingSummary } from './api';

const REASONS: Record<string, string> = {
  EXPIRED: 'Expired',
  LOW_STOCK: 'Low stock',
  EXPIRING_SOON: 'Expiring soon',
};

export function ShoppingPage() {
  const { data, isLoading, isError } = useShoppingSummary();
  const [copied, setCopied] = useState(false);

  const text = data
    ? Object.entries(data.byCategory)
        .map(
          ([cat, items]) =>
            `${label(cat)}\n${items.map((i) => `- ${i.name} (${REASONS[i.reason] ?? i.reason})`).join('\n')}`,
        )
        .join('\n\n')
    : '';

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shopping summary</h1>
        <Button variant="outline" size="sm" onClick={copy} disabled={!data?.totalItems}>
          Copy as text
        </Button>
      </div>
      <p role="status" className="text-sm">
        {copied ? 'Copied to clipboard' : ''}
      </p>
      {isLoading && <p>Loading…</p>}
      {isError && <p role="alert">Could not load shopping summary.</p>}
      {data && data.totalItems === 0 && <p>Nothing to buy right now.</p>}
      {data &&
        Object.entries(data.byCategory).map(([cat, items]) => (
          <section key={cat}>
            <h2 className="font-medium">{label(cat)}</h2>
            <ul className="list-disc pl-5">
              {items.map((i, idx) => (
                <li key={`${i.name}-${idx}`}>
                  {i.name} <span className="text-sm">({REASONS[i.reason] ?? i.reason})</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </main>
  );
}
