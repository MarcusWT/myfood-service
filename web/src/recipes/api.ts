import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { components } from '@/api/schema';

export type Recipe = components['schemas']['Recipe'];

export function useRecipeSuggestions() {
  return useQuery({
    queryKey: ['recipes', { limit: 10 }],
    enabled: false,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data } = await api.GET('/recipes/suggestions', {
        params: { query: { limit: 10 } },
        signal,
      });
      if (!data) throw new Error('Empty recipes response');
      return data;
    },
  });
}
