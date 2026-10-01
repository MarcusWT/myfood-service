import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useAlerts } from './api';
import { label } from '@/inventory/constants';

const DAY_OPTIONS = [1, 3, 7, 14, 30];

export function statusText(status: string, days: number) {
  if (status === 'EXPIRED') return `Expired ${Math.abs(days)}d ago`;
  return days === 0 ? 'Expires today' : `Expires in ${days}d`;
}

export function AlertsPage() {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get('withinDays'));
  const withinDays = DAY_OPTIONS.includes(raw) ? raw : 3;
  const { data, isLoading, isError } = useAlerts(withinDays);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Expiry alerts</h1>
      <div className="flex items-center gap-2">
        <Label htmlFor="within">Expiring within</Label>
        <select
          id="within"
          className="rounded-md border bg-transparent px-2 py-1"
          value={withinDays}
          onChange={(e) => setParams({ withinDays: e.target.value })}
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} {d === 1 ? 'day' : 'days'}
            </option>
          ))}
        </select>
      </div>
      {isLoading && <p>Loading…</p>}
      {isError && <p role="alert">Could not load alerts.</p>}
      {data && data.length === 0 && <p>Nothing is expiring in this window.</p>}
      <ul className="space-y-2">
        {data?.map((a) => {
          const Icon =
            a.status === 'EXPIRED' ? XCircle : a.status === 'CRITICAL' ? AlertTriangle : Clock;
          return (
            <li key={a.item.id} className="flex items-center justify-between rounded-md border p-3">
              <span>
                <span className="font-medium">{a.item.name}</span>{' '}
                <span className="text-sm text-muted-foreground">
                  {label(a.item.location)} · {a.item.quantity} {label(a.item.unit)}
                </span>
              </span>
              <span className="flex items-center gap-1 text-sm">
                <Icon className="size-4" aria-hidden="true" />
                {statusText(a.status, a.daysUntilExpiry)}
              </span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
