import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/api/client';
import { toastError, toastSuccess } from '@/lib/toast';
import type { FoodItem } from './constants';

export interface ListParams {
  location?: string;
  category?: string;
  name?: string;
  page: number;
}
export const PAGE_SIZE = 20;

export interface CreateInput {
  name: string;
  quantity: number;
  unit: FoodItem['unit'];
  location: FoodItem['location'];
  category: FoodItem['category'];
  bestBefore: string;
  notes?: string;
  minimumQuantity?: number;
}
export type UpdateInput = Partial<Omit<CreateInput, 'notes' | 'minimumQuantity'>> & {
  notes?: string | null;
  minimumQuantity?: number | null;
};

export function useFoodItems(p: ListParams) {
  return useQuery({
    queryKey: ['food-items', p],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.GET('/food-items', {
        params: {
          query: {
            location: (p.location || undefined) as FoodItem['location'] | undefined,
            category: (p.category || undefined) as FoodItem['category'] | undefined,
            name: p.name || undefined,
            page: p.page,
            limit: PAGE_SIZE,
          },
        },
      });
      return data!;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['food-items'] });
    void qc.invalidateQueries({ queryKey: ['alerts'] });
    void qc.invalidateQueries({ queryKey: ['shopping'] });
    qc.removeQueries({ queryKey: ['recipes'] });
  };
}

interface HookOptions {
  quietErrors?: boolean;
}

export function toCreateInput(item: FoodItem): CreateInput {
  return {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    location: item.location,
    category: item.category,
    bestBefore: item.bestBefore as string,
    ...(item.notes ? { notes: item.notes } : {}),
    ...(item.minimumQuantity !== undefined && item.minimumQuantity !== null
      ? { minimumQuantity: item.minimumQuantity }
      : {}),
  };
}

export function useCreateItem({ quietErrors }: HookOptions = {}) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateInput) => api.POST('/food-items', { body }),
    onSuccess: (_d, body) => {
      invalidate();
      toastSuccess(`Added "${body.name}"`);
    },
    onError: (e) => {
      if (!quietErrors) toastError(e);
    },
  });
}

export function useUpdateItem({ quietErrors }: HookOptions = {}) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; name: string; body: UpdateInput; previous?: UpdateInput }) =>
      api.PATCH('/food-items/{id}', { params: { path: { id: v.id } }, body: v.body }),
    onSuccess: (_d, v) => {
      invalidate();
      const canUndo = v.previous && Object.keys(v.previous).length > 0 && !('bestBefore' in v.body);
      toastSuccess(`Updated "${v.name}"`, {
        undo: canUndo
          ? async () => {
              await api.PATCH('/food-items/{id}', {
                params: { path: { id: v.id } },
                body: v.previous!,
              });
              invalidate();
            }
          : undefined,
      });
    },
    onError: (e) => {
      if (!quietErrors) toastError(e);
    },
  });
}

export function useDisposeItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; name: string; outcome: 'CONSUMED' | 'DISCARDED' }) =>
      api.POST('/food-items/{id}/dispose', {
        params: { path: { id: v.id } },
        body: { outcome: v.outcome },
      }),
    onSuccess: (_d, v) => {
      invalidate();
      toastSuccess(`Marked "${v.name}" as ${v.outcome === 'CONSUMED' ? 'consumed' : 'discarded'}`);
    },
    onError: (e) => toastError(e),
  });
}

export function useRemoveItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; item: FoodItem }) =>
      api.DELETE('/food-items/{id}', { params: { path: { id: v.id } } }),
    onSuccess: (_d, { item }) => {
      invalidate();
      const restorable = !!item.bestBefore && new Date(item.bestBefore).getTime() > Date.now();
      toastSuccess(`Removed "${item.name}"`, {
        undo: restorable
          ? async () => {
              await api.POST('/food-items', { body: toCreateInput(item) });
              invalidate();
            }
          : undefined,
      });
    },
    onError: (e) => toastError(e),
  });
}
