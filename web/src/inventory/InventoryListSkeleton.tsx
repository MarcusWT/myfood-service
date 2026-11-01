import { LoadingRegion } from '@/components/LoadingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export function InventoryListSkeleton() {
  return (
    <LoadingRegion label="Loading items…">
      <ul className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex h-14 flex-col justify-center gap-2 rounded-md border px-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
