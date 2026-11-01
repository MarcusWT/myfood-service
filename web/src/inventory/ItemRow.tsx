import { MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import { daysUntil, expiryState } from '@/lib/expiry';
import { label, type FoodItem } from './constants';
import { formatRelativeDay } from './relativeDate';
import { ItemStatusBadges } from './ItemStatusBadges';

export { ItemStatusBadges };

export type ItemAction = 'edit' | 'CONSUMED' | 'DISCARDED' | 'REMOVE';

export function ItemRow({
  item,
  onAction,
}: {
  item: FoodItem;
  onAction: (item: FoodItem, action: ItemAction) => void;
}) {
  const state = expiryState(daysUntil(item.bestBefore));
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-l-4 p-3 md:flex-row md:items-center md:justify-between',
        state === 'expired' && 'border-l-destructive bg-destructive/5',
        (state === 'today' || state === 'soon') && 'border-l-warning',
      )}
    >
      <div className="space-y-1">
        <p className="font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground">
          {item.quantity} {label(item.unit)} ·{' '}
          {item.bestBefore ? (
            <time dateTime={item.bestBefore} title={formatDate(item.bestBefore)}>
              {formatRelativeDay(item.bestBefore)}
            </time>
          ) : (
            'No best-before date'
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{label(item.location)}</Badge>
          <Badge variant="outline">{label(item.category)}</Badge>
          <ItemStatusBadges item={item} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onAction(item, 'CONSUMED')}>
          <span>
            Consumed <span className="sr-only">{item.name}</span>
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${item.name}`} />
            }
          >
            <MoreVertical aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction(item, 'edit')}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction(item, 'DISCARDED')}>
              Discarded
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onAction(item, 'REMOVE')}>
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
