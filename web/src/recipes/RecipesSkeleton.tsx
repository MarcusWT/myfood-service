import { LoadingRegion } from '@/components/LoadingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export function RecipesSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <LoadingRegion label="Finding recipes…">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border p-4">
            <Skeleton className="size-20 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
