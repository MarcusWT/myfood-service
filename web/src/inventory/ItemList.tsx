import { useState } from 'react';
import { ItemActionDialog, type ActionTarget } from './ItemActionDialog';
import type { FoodItem } from './constants';
import { ItemFormDialog } from './ItemFormDialog';
import { ItemRow, type ItemAction } from './ItemRow';

type Pending = { item: FoodItem; kind: ItemAction } | null;

export function ItemList({ items }: { items: FoodItem[] }) {
  const [pending, setPending] = useState<Pending>(null);
  const edit = pending?.kind === 'edit' ? pending.item : undefined;
  const action: ActionTarget | null =
    pending && pending.kind !== 'edit' ? { item: pending.item, kind: pending.kind } : null;
  const close = () => setPending(null);

  return (
    <>
      <ul className="space-y-2">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            onAction={(i, kind) => setPending({ item: i, kind })}
          />
        ))}
      </ul>
      <ItemFormDialog item={edit} open={!!edit} onOpenChange={(o) => !o && close()} />
      <ItemActionDialog target={action} onClose={close} />
    </>
  );
}
