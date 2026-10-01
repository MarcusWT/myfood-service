import { useState } from 'react';
import { AlertTriangle, Clock, PackageMinus } from 'lucide-react';
import { ApiError } from '@/api/errors';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDisposeItem, useRemoveItem } from './api';
import { daysUntil, label, type FoodItem } from './constants';
import { ItemFormDialog } from './ItemFormDialog';

type Action = 'CONSUMED' | 'DISCARDED' | 'REMOVE';

const COPY: Record<Action, { button: string; title: string; body: string }> = {
  CONSUMED: {
    button: 'Consumed',
    title: 'Mark as consumed?',
    body: 'It will leave your active inventory.',
  },
  DISCARDED: {
    button: 'Discarded',
    title: 'Mark as discarded?',
    body: 'It will leave your active inventory.',
  },
  REMOVE: {
    button: 'Remove',
    title: 'Remove permanently?',
    body: 'This deletes the item and cannot be undone.',
  },
};

export function ItemStatusBadges({ item }: { item: FoodItem }) {
  const d = daysUntil(item.bestBefore);
  const low = item.minimumQuantity !== undefined && item.quantity < item.minimumQuantity;
  return (
    <>
      {d !== null && d < 0 && (
        <Badge variant="destructive">
          <AlertTriangle aria-hidden /> Expired
        </Badge>
      )}
      {d !== null && d >= 0 && d <= 3 && (
        <Badge variant="secondary">
          <Clock aria-hidden /> {d === 0 ? 'Expires today' : `Expires in ${d}d`}
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

export function ItemRow({ item }: { item: FoodItem }) {
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dispose = useDisposeItem();
  const remove = useRemoveItem();

  async function confirm() {
    if (!action) return;
    setError(null);
    try {
      if (action === 'REMOVE') await remove.mutateAsync(item.id);
      else await dispose.mutateAsync({ id: item.id, outcome: action });
      setAction(null);
    } catch (e) {
      setAction(null);
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <p className="font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground">
          {item.quantity} {label(item.unit)} · {label(item.location)} · {label(item.category)} ·
          Best before {item.bestBefore ? new Date(item.bestBefore).toLocaleDateString() : 'n/a'}
        </p>
        <div className="flex flex-wrap gap-1">
          <ItemStatusBadges item={item} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${item.name}`}
        >
          Edit
        </Button>
        {(['CONSUMED', 'DISCARDED', 'REMOVE'] as Action[]).map((a) => (
          <Button
            key={a}
            size="sm"
            variant="outline"
            onClick={() => setAction(a)}
            aria-label={`${COPY[a].button} ${item.name}`}
          >
            {COPY[a].button}
          </Button>
        ))}
      </div>
      {editing && <ItemFormDialog item={item} open onOpenChange={setEditing} />}
      <AlertDialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{action && COPY[action].title}</AlertDialogTitle>
            <AlertDialogDescription>
              {action && `${item.name}: ${COPY[action].body}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirm()}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
