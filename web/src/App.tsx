import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { AuthForm } from '@/pages/AuthForm';
import { InventoryPage } from '@/inventory/InventoryPage';
import { DashboardPage } from '@/overview/DashboardPage';
import { AlertsPage } from '@/overview/AlertsPage';
import { ShoppingPage } from '@/overview/ShoppingPage';
import { RecipesPage } from '@/recipes/RecipesPage';
import { ErrorBoundary } from '@/shell/ErrorBoundary';
import { NotFoundPage } from '@/shell/NotFoundPage';
import { AppLayout } from '@/pages/AppLayout';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
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
      </AuthProvider>
    </ErrorBoundary>
  );
}
