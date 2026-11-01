import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { components } from '@/api/schema';
import { LOCATIONS, type Location } from '@/inventory/constants';

export type ShoppingSummary = components['schemas']['ShoppingSummary'];
export type ShoppingEntry = ShoppingSummary['byCategory'][string][number];

export function useAlerts(withinDays: number) {
  return useQuery({
    queryKey: ['alerts', withinDays],
    queryFn: async () => {
      const { data } = await api.GET('/alerts/expiry', { params: { query: { withinDays } } });
      if (!data) throw new Error('Empty alerts response');
      return data;
    },
  });
}

export function useShoppingSummary() {
  return useQuery({
    queryKey: ['shopping', 'summary'],
    queryFn: async () => {
      const { data } = await api.GET('/shopping/summary');
      if (!data) throw new Error('Empty shopping summary response');
      return data;
    },
  });
}

export function lowStockEntries(summary: ShoppingSummary | undefined): ShoppingEntry[] {
  if (!summary) return [];
  return Object.values(summary.byCategory)
    .flat()
    .filter((e) => e.reason === 'LOW_STOCK');
}

export function useLocationCounts() {
  const results = useQueries({
    queries: LOCATIONS.map((location) => ({
      queryKey: ['food-items', 'count', location],
      queryFn: async () => {
        const { data } = await api.GET('/food-items', {
          params: { query: { location, page: 1, limit: 1 } },
        });
        if (!data) throw new Error('Empty food items response');
        return data.total;
      },
    })),
  });
  const counts = {} as Record<Location, number | undefined>;
  const errors = {} as Record<Location, boolean>;
  LOCATIONS.forEach((l, i) => {
    counts[l] = results[i]?.data;
    errors[l] = !!results[i]?.isError;
  });
  const total = results.every((r) => r.data !== undefined)
    ? results.reduce((sum, r) => sum + (r.data ?? 0), 0)
    : undefined;
  return {
    counts,
    errors,
    total,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    refetch: () => Promise.all(results.map((r) => r.refetch())),
  };
}
