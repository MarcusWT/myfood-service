import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu, User } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MAIN_CONTENT_ID } from '@/shell/constants';
import { OfflineBanner } from '@/shell/OfflineBanner';
import { RouteOutlet } from '@/shell/RouteOutlet';
import { ThemeMenuItems } from '@/shell/ThemeToggle';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/inventory', label: 'Inventory', end: false },
  { to: '/alerts', label: 'Alerts', end: false },
  { to: '/shopping', label: 'Shopping', end: false },
  { to: '/recipes', label: 'Recipes', end: false },
];

function NavLinks({ orientation }: { orientation: 'horizontal' | 'vertical' }) {
  return (
    <>
      {NAV_ITEMS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              orientation === 'vertical' && 'py-2.5 text-base',
              isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}
      >
        <Menu aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>MYFood</SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
          <NavLinks orientation="vertical" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Account menu" />}
      >
        <User aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            Signed in as
            <span className="block truncate text-sm font-medium text-foreground">
              {user?.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <ThemeMenuItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout() {
  return (
    <>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <OfflineBanner />
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <MobileNav />
          <Link to="/" className="mr-2 font-semibold">
            MYFood
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            <NavLinks orientation="horizontal" />
          </nav>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl space-y-4 p-4 outline-none"
      >
        <RouteOutlet />
      </main>
    </>
  );
}
