import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

export function useAlerts(withinDays: number) {
  return useQuery({
    queryKey: ['alerts', withinDays],
    queryFn: async () => {
      const { data } = await api.GET('/alerts/expiry', { params: { query: { withinDays } } });
      return data!;
    },
  });
}

export function useShoppingSummary() {
  return useQuery({
    queryKey: ['shopping', 'summary'],
    queryFn: async () => {
      const { data } = await api.GET('/shopping/summary');
      return data!;
    },
  });
}
