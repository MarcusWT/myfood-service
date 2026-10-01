import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const KEY = 'myfood.theme';

function initial(): boolean {
  const stored = localStorage.getItem(KEY);
  if (stored) return stored === 'dark';
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(initial);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(KEY, dark ? 'dark' : 'light');
  }, [dark]);
  return (
    <Button variant="outline" size="sm" aria-pressed={dark} onClick={() => setDark((d) => !d)}>
      Dark mode
    </Button>
  );
}
