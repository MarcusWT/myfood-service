import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormError } from '@/components/form-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateItem, useUpdateItem, type CreateInput, type UpdateInput } from './api';
import { toDateInput, toIsoEndOfDay } from '@/lib/date';
import { addDays, addMonths, toLocalDateInput } from './dates';
import { CATEGORIES, LOCATIONS, UNITS, label, type FoodItem } from './constants';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  quantity: z.string().refine((v) => Number(v) > 0, 'Quantity must be greater than 0'),
  unit: z.string().min(1),
  location: z.string().min(1),
  category: z.string().min(1),
  bestBefore: z.string().min(1, 'Best before date is required'),
  minimumQuantity: z.string().refine((v) => v === '' || Number(v) >= 0, 'Must be 0 or more'),
  notes: z.string().max(500, 'Notes must be 500 characters or fewer'),
});
type Values = z.infer<typeof schema>;

const NOTES_MAX = 500;

const PRESETS: { label: string; apply: (d: Date) => Date }[] = [
  { label: '+3 days', apply: (d) => addDays(d, 3) },
  { label: '+1 week', apply: (d) => addDays(d, 7) },
  { label: '+1 month', apply: (d) => addMonths(d, 1) },
];

interface DialogProps {
  item?: FoodItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemFormDialog({ item, open, onOpenChange }: DialogProps) {
  const [lastItem, setLastItem] = useState(item);
  if (item && item !== lastItem) setLastItem(item);
  const shown = item ?? lastItem;
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => !(busy && !o) && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <ItemForm
          key={shown?.id ?? 'new'}
          item={shown}
          onClose={() => onOpenChange(false)}
          onBusyChange={setBusy}
        />
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({
  item,
  onClose,
  onBusyChange,
}: {
  item?: FoodItem;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const create = useCreateItem({ quietErrors: true });
  const update = useUpdateItem({ quietErrors: true });
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? '',
      quantity: item ? String(item.quantity) : '',
      unit: item?.unit ?? 'UNITS',
      location: item?.location ?? 'FRIDGE',
      category: item?.category ?? 'OTHER',
      bestBefore: toDateInput(item?.bestBefore ?? null),
      minimumQuantity: item?.minimumQuantity != null ? String(item.minimumQuantity) : '',
      notes: item?.notes ?? '',
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const body: CreateInput = {
      name: v.name,
      quantity: Number(v.quantity),
      unit: v.unit as CreateInput['unit'],
      location: v.location as CreateInput['location'],
      category: v.category as CreateInput['category'],
      bestBefore: toIsoEndOfDay(v.bestBefore),
      ...(v.minimumQuantity !== '' && { minimumQuantity: Number(v.minimumQuantity) }),
      ...(v.notes && { notes: v.notes }),
    };
    try {
      if (item) {
        // The API only accepts future bestBefore, so omit it unless the user changed it.
        const { bestBefore, ...rest } = body;
        delete rest.notes;
        delete rest.minimumQuantity;
        // Send optional fields only when edited (so a stale form can't clobber
        // another client's change); null clears them.
        const patch: UpdateInput = {
          ...rest,
          ...(dirtyFields.notes && { notes: v.notes ? v.notes : null }),
          ...(dirtyFields.minimumQuantity && {
            minimumQuantity: v.minimumQuantity !== '' ? Number(v.minimumQuantity) : null,
          }),
        };
        const sent: UpdateInput = dirtyFields.bestBefore ? { ...patch, bestBefore } : patch;
        const previous: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(sent)) {
          const before = (item as Record<string, unknown>)[k] ?? null;
          if (before !== val) previous[k] = before;
        }
        await update.mutateAsync({
          id: item.id,
          name: v.name,
          body: sent,
          previous: previous as UpdateInput,
        });
      } else {
        await create.mutateAsync(body);
      }
      reset(v);
      onClose();
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setFormError('Could not reach the server. Try again.');
      } else if (err.status === 409) {
        setError('name', { message: err.message }, { shouldFocus: true });
      } else if (err.status === 400) {
        let mapped = false;
        for (const i of err.issues) {
          if (i.path in schema.shape) {
            setError(i.path as keyof Values, { message: i.message }, { shouldFocus: !mapped });
            mapped = true;
          }
        }
        if (!mapped) setFormError(err.message);
      } else setFormError(err.message);
    }
  });

  useEffect(() => {
    onBusyChange(isSubmitting);
  }, [isSubmitting, onBusyChange]);

  const notesLength = useWatch({ control, name: 'notes' }).length;
  const overLimit = notesLength > NOTES_MAX;

  const err = (k: keyof Values) =>
    errors[k] && <FormError id={`${k}-error`}>{errors[k]?.message}</FormError>;
  const a11y = (k: keyof Values, extra?: string) => ({
    'aria-invalid': !!errors[k],
    'aria-describedby':
      [errors[k] ? `${k}-error` : null, extra].filter(Boolean).join(' ') || undefined,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{item ? 'Edit item' : 'Add item'}</DialogTitle>
        <DialogDescription>
          {item ? 'Update the details of this item.' : 'Add a food item to your inventory.'}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        {formError && <FormError>{formError}</FormError>}
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...a11y('name')} {...register('name')} />
          {err('name')}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              inputMode="decimal"
              step="any"
              {...a11y('quantity')}
              {...register('quantity')}
            />
            {err('quantity')}
          </div>
          <div className="space-y-1">
            <Label htmlFor="unit">Unit</Label>
            <NativeSelect id="unit" {...register('unit')}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {label(u)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="location">Location</Label>
            <NativeSelect id="location" {...register('location')}>
              {LOCATIONS.map((u) => (
                <option key={u} value={u}>
                  {label(u)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="category">Category</Label>
            <NativeSelect id="category" {...register('category')}>
              {CATEGORIES.map((u) => (
                <option key={u} value={u}>
                  {label(u)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bestBefore">Best before</Label>
            <Input
              id="bestBefore"
              type="date"
              {...a11y('bestBefore')}
              {...register('bestBefore')}
            />
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    setValue('bestBefore', toLocalDateInput(p.apply(new Date())), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {err('bestBefore')}
          </div>
          <div className="space-y-1">
            <Label htmlFor="minimumQuantity">Low-stock threshold</Label>
            <Input
              id="minimumQuantity"
              type="number"
              inputMode="decimal"
              step="any"
              {...a11y('minimumQuantity')}
              {...register('minimumQuantity')}
            />
            {err('minimumQuantity')}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" {...a11y('notes', 'notes-count')} {...register('notes')} />
          <p
            id="notes-count"
            aria-live="polite"
            className={`text-right text-xs ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {notesLength}/{NOTES_MAX}
          </p>
          {err('notes')}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" pending={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
