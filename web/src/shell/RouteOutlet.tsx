import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageFallback } from './PageFallback';
import { RouteErrorBoundary } from './RouteErrorBoundary';

export function RouteOutlet() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </RouteErrorBoundary>
  );
}
