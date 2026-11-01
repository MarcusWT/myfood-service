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
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useDisposeItem, useRemoveItem } from './api';
import type { FoodItem } from './constants';

export type DisposeKind = 'CONSUMED' | 'DISCARDED' | 'REMOVE';
export interface ActionTarget {
  item: FoodItem;
  kind: DisposeKind;
}

const COPY: Record<DisposeKind, { title: string; body: string; confirm: string }> = {
  CONSUMED: {
    title: 'Mark as consumed?',
    body: 'It will leave your active inventory.',
    confirm: 'Confirm',
  },
  DISCARDED: {
    title: 'Mark as discarded?',
    body: 'It will leave your active inventory.',
    confirm: 'Confirm',
  },
  REMOVE: {
    title: 'Remove permanently?',
    body: 'This deletes the item and cannot be undone.',
    confirm: 'Remove',
  },
};

export function ItemActionDialog({
  target,
  onClose,
}: {
  target: ActionTarget | null;
  onClose: () => void;
}) {
  const dispose = useDisposeItem();
  const remove = useRemoveItem();
  const isPending = dispose.isPending || remove.isPending;
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);
  const t = target ?? shown;

  function confirm(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!target || isPending) return;
    const { item, kind } = target;
    const opts = { onSuccess: onClose };
    if (kind === 'REMOVE') remove.mutate({ id: item.id, item }, opts);
    else dispose.mutate({ id: item.id, name: item.name, outcome: kind }, opts);
  }

  return (
    <AlertDialog open={target !== null} onOpenChange={(o) => !o && !isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t && COPY[t.kind].title}</AlertDialogTitle>
          <AlertDialogDescription>
            {t && `${t.item.name}: ${COPY[t.kind].body}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={t?.kind === 'REMOVE' ? 'destructive' : 'default'}
            disabled={isPending}
            onClick={confirm}
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden className="animate-spin" /> Working…
              </>
            ) : (
              t && COPY[t.kind].confirm
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
