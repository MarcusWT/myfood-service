import { LoadingRegion } from '@/components/LoadingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export function ShoppingListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading shopping list…">
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <ul className="space-y-2">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-4xl" />
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
