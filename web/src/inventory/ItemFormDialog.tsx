import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateItem, useUpdateItem, type CreateInput } from './api';
import { CATEGORIES, LOCATIONS, UNITS, label, type FoodItem } from './constants';

const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm';

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

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
// End of the chosen local day, so "today" is still a future instant.
const toIso = (d: string) => new Date(`${d}T23:59:59`).toISOString();

export function ItemFormDialog({
  item,
  open,
  onOpenChange,
}: {
  item?: FoodItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateItem();
  const update = useUpdateItem();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
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
      minimumQuantity: item?.minimumQuantity !== undefined ? String(item.minimumQuantity) : '',
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
      bestBefore: toIso(v.bestBefore),
      ...(v.minimumQuantity !== '' && { minimumQuantity: Number(v.minimumQuantity) }),
      ...(v.notes && { notes: v.notes }),
    };
    try {
      if (item) {
        // The API only accepts future bestBefore, so omit it unless the user changed it.
        const { bestBefore, ...rest } = body;
        await update.mutateAsync({
          id: item.id,
          body: dirtyFields.bestBefore ? { ...rest, bestBefore } : rest,
        });
      } else {
        await create.mutateAsync(body);
      }
      reset(v);
      onOpenChange(false);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setFormError('Could not reach the server. Try again.');
      } else if (err.status === 409) {
        setError('name', { message: err.message });
      } else if (err.status === 400) {
        let mapped = false;
        for (const i of err.issues) {
          if (i.path in schema.shape) {
            setError(i.path as keyof Values, { message: i.message });
            mapped = true;
          }
        }
        if (!mapped) setFormError(err.message);
      } else setFormError(err.message);
    }
  });

  const err = (k: keyof Values) =>
    errors[k] && (
      <p id={`${k}-error`} className="text-sm text-red-600">
        {errors[k]?.message}
      </p>
    );
  const a11y = (k: keyof Values) => ({
    'aria-invalid': !!errors[k],
    'aria-describedby': errors[k] ? `${k}-error` : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit item' : 'Add item'}</DialogTitle>
          <DialogDescription>
            {item ? 'Update the details of this item.' : 'Add a food item to your inventory.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-3">
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...a11y('name')} {...register('name')} />
            {err('name')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                {...a11y('quantity')}
                {...register('quantity')}
              />
              {err('quantity')}
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit">Unit</Label>
              <select id="unit" className={selectClass} {...register('unit')}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {label(u)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="location">Location</Label>
              <select id="location" className={selectClass} {...register('location')}>
                {LOCATIONS.map((u) => (
                  <option key={u} value={u}>
                    {label(u)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <select id="category" className={selectClass} {...register('category')}>
                {CATEGORIES.map((u) => (
                  <option key={u} value={u}>
                    {label(u)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bestBefore">Best before</Label>
              <Input
                id="bestBefore"
                type="date"
                {...a11y('bestBefore')}
                {...register('bestBefore')}
              />
              {err('bestBefore')}
            </div>
            <div className="space-y-1">
              <Label htmlFor="minimumQuantity">Low-stock threshold</Label>
              <Input
                id="minimumQuantity"
                type="number"
                step="any"
                {...a11y('minimumQuantity')}
                {...register('minimumQuantity')}
              />
              {err('minimumQuantity')}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...a11y('notes')} {...register('notes')} />
            {err('notes')}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
