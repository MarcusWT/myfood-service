import { AlertTriangle, Clock, PackageMinus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { daysUntil, expiryState, expiryText } from '@/lib/expiry';
import type { FoodItem } from './constants';

export function ItemStatusBadges({ item }: { item: FoodItem }) {
  const d = daysUntil(item.bestBefore);
  const state = expiryState(d);
  const low = item.minimumQuantity !== undefined && item.quantity < item.minimumQuantity;
  return (
    <>
      {state === 'expired' && (
        <Badge variant="destructive">
          <AlertTriangle aria-hidden /> Expired
        </Badge>
      )}
      {(state === 'today' || state === 'soon') && (
        <Badge variant="secondary">
          <Clock aria-hidden /> {expiryText(d as number)}
        </Badge>
      )}
      {low && (
        <Badge variant="outline">
          <PackageMinus aria-hidden /> Low stock
        </Badge>
      )}
    </>
  );
}
