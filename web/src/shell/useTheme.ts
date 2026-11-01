import { useCallback, useSyncExternalStore } from 'react';
import {
  THEME_KEY,
  applyTheme,
  readStoredTheme,
  resolveTheme,
  type ResolvedTheme,
  type Theme,
} from './theme';

interface Snapshot {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
}

const listeners = new Set<() => void>();
let snapshot: Snapshot | null = null;

function compute(theme: Theme): Snapshot {
  const resolvedTheme = resolveTheme(theme);
  if (snapshot && snapshot.theme === theme && snapshot.resolvedTheme === resolvedTheme) {
    return snapshot;
  }
  return { theme, resolvedTheme };
}

function refresh(theme = readStoredTheme()) {
  const next = compute(theme);
  if (next === snapshot) return;
  snapshot = next;
  applyTheme(next.resolvedTheme);
  listeners.forEach((l) => l());
}

function onStorage(e: StorageEvent) {
  if (e.key === null || e.key === THEME_KEY) refresh();
}

function onMediaChange() {
  refresh();
}

function subscribe(cb: () => void) {
  if (listeners.size === 0) {
    refresh();
    applyTheme(getSnapshot().resolvedTheme);
    window.addEventListener('storage', onStorage);
    if (typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onMediaChange);
    }
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage);
      if (typeof window.matchMedia === 'function') {
        window
          .matchMedia('(prefers-color-scheme: dark)')
          .removeEventListener('change', onMediaChange);
      }
    }
  };
}

function getSnapshot(): Snapshot {
  if (!snapshot) snapshot = compute(readStoredTheme());
  return snapshot;
}

export function useTheme() {
  const { theme, resolvedTheme } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setTheme = useCallback((next: Theme) => {
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable: keep in-memory only */
    }
    refresh(next);
  }, []);
  return { theme, resolvedTheme, setTheme };
}
