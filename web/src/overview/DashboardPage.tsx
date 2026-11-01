import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Package, Plus, ShoppingCart } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { ItemFormDialog } from '@/inventory/ItemFormDialog';
import { LOCATIONS, label } from '@/inventory/constants';
import { statusText } from '@/lib/expiry';
import { PageHeader } from '@/shell/PageHeader';
import { lowStockEntries, useAlerts, useLocationCounts, useShoppingSummary } from './api';

function SectionError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <p role="alert" className="text-sm">
        Could not load {what}.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function DashboardPage() {
  const [adding, setAdding] = useState(false);
  const locations = useLocationCounts();
  const alerts = useAlerts(3);
  const shopping = useShoppingSummary();
  const lowStock = lowStockEntries(shopping.data);

  const value = (v: number | undefined, failed: boolean) =>
    v !== undefined ? v : failed ? '–' : <Skeleton className="h-8 w-12" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" /> Add item
        </Button>
        <Link to="/alerts" className={buttonVariants({ variant: 'outline' })}>
          View alerts
        </Link>
        <Link to="/shopping" className={buttonVariants({ variant: 'outline' })}>
          Shopping list
        </Link>
        <Link to="/recipes" className={buttonVariants({ variant: 'outline' })}>
          Recipe ideas
        </Link>
      </div>
      <ItemFormDialog open={adding} onOpenChange={setAdding} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Items in stock"
          icon={Package}
          tone="primary"
          to="/inventory"
          value={value(locations.total, locations.isError)}
        />
        <StatCard
          label="Expiring within 3 days"
          icon={AlertTriangle}
          tone="warning"
          to="/alerts"
          value={value(alerts.data?.length, alerts.isError)}
        />
        <StatCard
          label="To buy"
          icon={ShoppingCart}
          tone="info"
          to="/shopping"
          value={value(shopping.data?.totalItems, shopping.isError)}
        />
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">By location</h2>
        {locations.isError && (
          <SectionError what="location counts" onRetry={() => void locations.refetch()} />
        )}
        <ul className="grid gap-3 sm:grid-cols-3">
          {LOCATIONS.map((l) => (
            <li key={l}>
              <Link to={`/inventory?location=${l}`} className="block">
                <Card interactive size="sm">
                  <CardContent className="flex items-center justify-between">
                    <span>{label(l)}</span>
                    <span className="font-semibold tabular-nums">
                      {value(locations.counts[l], locations.errors[l])}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Soonest to expire</h2>
          <Link to="/alerts" className="text-sm underline">
            View all
          </Link>
        </div>
        {alerts.isError && <SectionError what="alerts" onRetry={() => void alerts.refetch()} />}
        {alerts.data && alerts.data.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing expiring soon"
            action={{ label: 'View inventory', to: '/inventory', variant: 'outline' }}
          />
        )}
        {alerts.data && alerts.data.length > 0 && (
          <ul className="space-y-1">
            {alerts.data.slice(0, 3).map((a) => (
              <li key={a.item.id}>
                <Link
                  to={`/inventory?name=${encodeURIComponent(a.item.name)}`}
                  className="flex justify-between rounded-md border p-2 hover:bg-muted"
                >
                  <span>{a.item.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {statusText(a.status, a.daysUntilExpiry)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Running low</h2>
        {shopping.isError && (
          <SectionError what="shopping summary" onRetry={() => void shopping.refetch()} />
        )}
        {shopping.data && lowStock.length === 0 && (
          <EmptyState icon={CheckCircle2} title="Nothing running low" />
        )}
        {lowStock.length > 0 && (
          <>
            <ul className="space-y-1">
              {lowStock.slice(0, 5).map((e, idx) => (
                <li key={`${e.name}-${idx}`} className="flex justify-between rounded-md border p-2">
                  <span>{e.name}</span>
                  {e.currentQuantity !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      {e.currentQuantity}
                      {e.currentUnit ? ` ${label(e.currentUnit)}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {lowStock.length > 5 && (
              <Link to="/shopping" className="text-sm underline">
                See all {lowStock.length} on the shopping list
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
