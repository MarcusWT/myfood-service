import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { AuthForm } from '@/pages/AuthForm';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/shell/ErrorBoundary';
import { NotFoundPage } from '@/shell/NotFoundPage';
import { PageFallback } from '@/shell/PageFallback';
import { RouteAnnouncer } from '@/shell/RouteAnnouncer';
import { AppLayout } from '@/pages/AppLayout';

const DashboardPage = lazy(() =>
  import('@/overview/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const InventoryPage = lazy(() =>
  import('@/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })),
);
const AlertsPage = lazy(() =>
  import('@/overview/AlertsPage').then((m) => ({ default: m.AlertsPage })),
);
const ShoppingPage = lazy(() =>
  import('@/overview/ShoppingPage').then((m) => ({ default: m.ShoppingPage })),
);
const RecipesPage = lazy(() =>
  import('@/recipes/RecipesPage').then((m) => ({ default: m.RecipesPage })),
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouteAnnouncer />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<AuthForm mode="login" />} />
            <Route path="/register" element={<AuthForm mode="register" />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/shopping" element={<ShoppingPage />} />
                <Route path="/recipes" element={<RecipesPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <Toaster />
      </AuthProvider>
    </ErrorBoundary>
  );
}
