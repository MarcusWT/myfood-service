import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type PageItem = number | 'gap-start' | 'gap-end';

export function getPageRange(page: number, totalPages: number, siblings = 1): PageItem[] {
  const edge = siblings * 2 + 2;
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  if (totalPages <= siblings * 2 + 5) return range(1, totalPages);
  if (page <= edge) return [...range(1, edge + 1), 'gap-end', totalPages];
  if (page > totalPages - edge) return [1, 'gap-start', ...range(totalPages - edge, totalPages)];
  return [1, 'gap-start', ...range(page - siblings, page + siblings), 'gap-end', totalPages];
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblings = 1,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblings?: number;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft aria-hidden /> Previous
      </Button>
      {getPageRange(page, totalPages, siblings).map((p) =>
        typeof p === 'number' ? (
          <Button
            key={p}
            size="sm"
            variant={p === page ? 'default' : 'outline'}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            disabled={disabled}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ) : (
          <span key={p} aria-hidden className="px-1 text-muted-foreground">
            …
          </span>
        ),
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
