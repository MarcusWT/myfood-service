import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { OfflineBanner } from '@/shell/OfflineBanner';
import { ThemeToggle } from '@/shell/ThemeToggle';
import { Button } from '@/components/ui/button';

export function AppLayout() {
  const { user, logout } = useAuth();
  return (
    <>
      <OfflineBanner />
      <header className="flex items-center justify-between border-b px-4 py-2">
        <nav aria-label="Main" className="flex items-center gap-4">
          <span className="font-semibold">MYFood</span>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/inventory">Inventory</NavLink>
          <NavLink to="/alerts">Alerts</NavLink>
          <NavLink to="/shopping">Shopping</NavLink>
          <NavLink to="/recipes">Recipes</NavLink>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span>Signed in as {user?.email}</span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </header>
      <Outlet />
    </>
  );
}
