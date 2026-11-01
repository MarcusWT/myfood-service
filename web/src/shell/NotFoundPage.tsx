import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Button, buttonVariants } from '@/components/ui/button';
import { MAIN_CONTENT_ID } from './constants';

export function NotFoundPage() {
  const { pathname } = useLocation();
  const { status } = useAuth();
  const navigate = useNavigate();
  const authed = status !== 'unauthenticated';
  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="mx-auto max-w-md space-y-3 p-8 text-center outline-none"
    >
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <p className="font-mono text-sm break-all text-muted-foreground">{pathname}</p>
      <div className="flex justify-center gap-2">
        <Link to={authed ? '/' : '/login'} className={buttonVariants()}>
          {authed ? 'Back to dashboard' : 'Go to log in'}
        </Link>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    </main>
  );
}
