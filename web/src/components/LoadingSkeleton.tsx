import type { ReactNode } from 'react';

export function LoadingRegion({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
