import { formatDate } from '@/lib/date';
import { daysUntil } from '@/lib/expiry';

export function formatRelativeDay(iso: string | null, now = new Date()): string {
  if (!iso) return 'No best-before date';
  const d = daysUntil(iso, now);
  if (d === null) return 'No best-before date';
  if (d < 0) return `Expired ${Math.abs(d)} ${Math.abs(d) === 1 ? 'day' : 'days'} ago`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d <= 30) return `in ${d} days`;
  return formatDate(iso);
}
