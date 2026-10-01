import { Link } from 'react-router-dom';
import { useFoodItems } from '@/inventory/api';
import { useAlerts, useShoppingSummary } from './api';
import { statusText } from './AlertsPage';

export function DashboardPage() {
  const items = useFoodItems({ page: 1 });
  const alerts = useAlerts(3);
  const shopping = useShoppingSummary();

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/inventory" className="rounded-md border p-4">
          <div className="text-2xl font-bold">{items.data?.total ?? '–'}</div>
          <div>Items in stock</div>
        </Link>
        <Link to="/alerts" className="rounded-md border p-4">
          <div className="text-2xl font-bold">{alerts.data?.length ?? '–'}</div>
          <div>Expiring within 3 days</div>
        </Link>
        <Link to="/shopping" className="rounded-md border p-4">
          <div className="text-2xl font-bold">{shopping.data?.totalItems ?? '–'}</div>
          <div>To buy</div>
        </Link>
      </div>
      {alerts.data && alerts.data.length > 0 && (
        <section>
          <h2 className="font-medium">Soonest to expire</h2>
          <ul>
            {alerts.data.slice(0, 3).map((a) => (
              <li key={a.item.id}>
                {a.item.name} — {statusText(a.status, a.daysUntilExpiry)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
