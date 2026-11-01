import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { BellOff } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { NativeSelect } from '@/components/ui/native-select';
import { useAlerts } from './api';
import { AlertsListSkeleton } from './AlertsListSkeleton';
import { label } from '@/inventory/constants';
import { statusText } from '@/lib/expiry';
import { PageHeader } from '@/shell/PageHeader';

export { statusText };

const DAY_OPTIONS = [1, 3, 7, 14, 30];

export function AlertsPage() {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get('withinDays'));
  const withinDays = DAY_OPTIONS.includes(raw) ? raw : 3;
  const { data, isLoading, isError } = useAlerts(withinDays);

  return (
    <div className="space-y-4">
      <PageHeader title="Expiry alerts" />
      <div className="flex items-center gap-2">
        <Label htmlFor="within">Expiring within</Label>
        <NativeSelect
          id="within"
          value={withinDays}
          onChange={(e) => setParams({ withinDays: e.target.value })}
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} {d === 1 ? 'day' : 'days'}
            </option>
          ))}
        </NativeSelect>
      </div>
      {isLoading && <AlertsListSkeleton />}
      {isError && <p role="alert">Could not load alerts.</p>}
      {data && data.length === 0 && (
        <EmptyState
          icon={BellOff}
          title="Nothing is expiring"
          description={`No items expire within ${withinDays} ${withinDays === 1 ? 'day' : 'days'}.`}
          action={{ label: 'View inventory', to: '/inventory', variant: 'outline' }}
        />
      )}
      <ul className="space-y-2">
        {data?.map((a) => {
          const Icon =
            a.status === 'EXPIRED' ? XCircle : a.status === 'CRITICAL' ? AlertTriangle : Clock;
          return (
            <li key={a.item.id}>
              <Card
                size="sm"
                className="flex-row items-center justify-between gap-3 px-(--card-spacing)"
              >
                <span>
                  <span className="font-medium">{a.item.name}</span>{' '}
                  <span className="text-sm text-muted-foreground">
                    {label(a.item.location)} · {a.item.quantity} {label(a.item.unit)}
                  </span>
                </span>
                <span
                  className={cn(
                    'flex items-center gap-1 text-sm',
                    a.status === 'EXPIRED' && 'text-destructive',
                    a.status === 'CRITICAL' && 'text-warning-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {statusText(a.status, a.daysUntilExpiry)}
                </span>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
