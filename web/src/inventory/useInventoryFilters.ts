import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { label } from './constants';

export interface FilterChip {
  key: string;
  label: string;
  remove: () => void;
}

export function useInventoryFilters() {
  const [params, setParams] = useSearchParams();
  const location = params.get('location') ?? '';
  const category = params.get('category') ?? '';
  const name = params.get('name') ?? '';
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1);

  const [search, setSearch] = useState(name);
  const [syncedName, setSyncedName] = useState(name);
  const [written, setWritten] = useState<string | null>(null);
  if (name !== syncedName) {
    setSyncedName(name);
    if (written === name) setWritten(null);
    else setSearch(name);
  }

  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  const update = useCallback(
    (patch: Record<string, string>, resetPage = true) => {
      if ('name' in patch) setWritten(patch.name ?? '');
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const debounced = useDebouncedValue(search.trim());
  const lastDebounced = useRef(debounced);
  useEffect(() => {
    if (debounced === lastDebounced.current) return;
    lastDebounced.current = debounced;
    if (debounced !== nameRef.current) update({ name: debounced });
  }, [debounced, update]);

  const setLocation = (v: string) => update({ location: v });
  const setCategory = (v: string) => update({ category: v });
  const setPage = (p: number) => update({ page: p > 1 ? String(Math.floor(p)) : '' }, false);
  const clear = () => {
    setSearch('');
    setWritten('');
    setParams(new URLSearchParams(), { replace: true });
  };
  const removeName = () => {
    setSearch('');
    update({ name: '' });
  };

  const chips: FilterChip[] = [];
  if (location)
    chips.push({
      key: 'location',
      label: `Location: ${label(location)}`,
      remove: () => setLocation(''),
    });
  if (category)
    chips.push({
      key: 'category',
      label: `Category: ${label(category)}`,
      remove: () => setCategory(''),
    });
  if (name) chips.push({ key: 'name', label: `Search: ${name}`, remove: removeName });

  return {
    filters: { location, category, name, page },
    search,
    setSearch,
    setLocation,
    setCategory,
    setPage,
    clear,
    hasActiveFilters: chips.length > 0,
    chips,
  };
}
