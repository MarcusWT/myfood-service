import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { status, expired, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <p role="status" className="p-6">
        Loading…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-md space-y-3 p-8 text-center">
        <h1 className="text-xl font-semibold">Can't reach the server</h1>
        <p>Check your connection and try again.</p>
        <Button onClick={retry}>Retry</Button>
      </main>
    );
  }
  if (status === 'unauthenticated') {
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <Navigate to={`/login?next=${next}`} replace state={expired ? { expired: true } : null} />
    );
  }
  return <Outlet />;
}
