import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/api/client';
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
export type UpdateInput = Partial<CreateInput>;

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

function useInvalidating<TVars>(fn: (v: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['food-items'] });
      void qc.invalidateQueries({ queryKey: ['alerts'] });
      void qc.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
}

export const useCreateItem = () =>
  useInvalidating((body: CreateInput) => api.POST('/food-items', { body }));

export const useUpdateItem = () =>
  useInvalidating((v: { id: string; body: UpdateInput }) =>
    api.PATCH('/food-items/{id}', { params: { path: { id: v.id } }, body: v.body }),
  );

export const useDisposeItem = () =>
  useInvalidating((v: { id: string; outcome: 'CONSUMED' | 'DISCARDED' }) =>
    api.POST('/food-items/{id}/dispose', {
      params: { path: { id: v.id } },
      body: { outcome: v.outcome },
    }),
  );

export const useRemoveItem = () =>
  useInvalidating((id: string) => api.DELETE('/food-items/{id}', { params: { path: { id } } }));
