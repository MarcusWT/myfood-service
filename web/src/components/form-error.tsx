import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FormError({
  id,
  children,
  className,
}: {
  id?: string;
  children?: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn('text-sm text-destructive', className)}>
      {children}
    </p>
  );
}
