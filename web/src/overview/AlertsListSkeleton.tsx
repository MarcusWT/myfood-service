import { LoadingRegion } from '@/components/LoadingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export function AlertsListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading alerts…">
      <ul className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center justify-between rounded-md border p-3">
            <span className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </span>
            <Skeleton className="h-4 w-20" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
