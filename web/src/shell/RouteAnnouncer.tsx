import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MAIN_CONTENT_ID } from './constants';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/inventory': 'Inventory',
  '/alerts': 'Alerts',
  '/shopping': 'Shopping',
  '/recipes': 'Recipes',
  '/login': 'Log in',
  '/register': 'Create account',
};

export function routeTitle(pathname: string): string {
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (ROUTE_TITLES[normalised]) return ROUTE_TITLES[normalised];
  const prefix = ['/inventory', '/alerts', '/shopping', '/recipes'].find((p) =>
    normalised.startsWith(`${p}/`),
  );
  return prefix ? ROUTE_TITLES[prefix]! : 'Page not found';
}

export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const previous = useRef<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const title = routeTitle(pathname);
    document.title = `${title} · MYFood`;
    if (previous.current !== null && previous.current !== pathname) {
      setMessage(`Navigated to ${title}`);
      const target =
        document.getElementById(MAIN_CONTENT_ID) ?? document.querySelector<HTMLElement>('h1');
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    }
    previous.current = pathname;
  }, [pathname]);

  return (
    <div aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
