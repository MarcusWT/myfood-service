import { useEffect, useState, useSyncExternalStore } from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

const BACK_ONLINE_MS = 3000;

export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onOnline = () => {
      setBackOnline(true);
      clearTimeout(timer);
      timer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
    };
    const onOffline = () => {
      clearTimeout(timer);
      setBackOnline(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!online) {
    return (
      <div
        role="status"
        className="bg-warning px-4 py-2 text-center text-sm text-warning-foreground"
      >
        You are offline. Changes will not be saved until you reconnect.
      </div>
    );
  }
  if (backOnline) {
    return (
      <div
        role="status"
        className="bg-success px-4 py-2 text-center text-sm text-success-foreground"
      >
        You're back online
      </div>
    );
  }
  return null;
}
