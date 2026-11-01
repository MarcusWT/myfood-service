import { useCallback, useEffect, useMemo, useState } from 'react';

export const itemKey = (i: { name: string; category: string; reason: string }) =>
  `${i.category}|${i.name.trim().toLowerCase()}|${i.reason}`;

// Keys are stored per user and intentionally kept on logout so a user's ticks survive re-login.
const storageKey = (userId: string) => `myfood.shopping.checked.${userId}`;

function read(userId: string | undefined): string[] {
  if (!userId) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]');
    return Array.isArray(parsed) && parsed.every((k) => typeof k === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function write(userId: string | undefined, keys: string[]) {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(keys));
  } catch {
    // storage unavailable: keep in-memory state only
  }
}

export function useCheckedItems(userId: string | undefined, currentKeys: string[] | undefined) {
  const [state, setState] = useState(() => ({ userId, keys: read(userId) }));
  let keys = state.keys;
  if (state.userId !== userId) {
    keys = read(userId);
    setState({ userId, keys });
  }

  const liveSig = currentKeys?.join('\n');
  const effective = useMemo(() => {
    if (liveSig === undefined) return keys;
    const live = new Set(liveSig.split('\n'));
    return keys.filter((k) => live.has(k));
  }, [keys, liveSig]);
  const stale = effective.length !== keys.length;

  useEffect(() => {
    if (!stale) return;
    write(userId, effective);
  }, [stale, userId, effective]);

  const isChecked = (key: string) => effective.includes(key);

  const toggle = useCallback(
    (key: string) => {
      const next = effective.includes(key)
        ? effective.filter((k) => k !== key)
        : [...effective, key];
      write(userId, next);
      setState({ userId, keys: next });
    },
    [effective, userId],
  );

  const clearAll = useCallback(() => {
    write(userId, []);
    setState({ userId, keys: [] });
  }, [userId]);

  return { isChecked, toggle, clearAll };
}
