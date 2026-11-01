import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  to?: string;
  variant?: 'default' | 'outline';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: EmptyStateAction;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action &&
        (action.to ? (
          <Link to={action.to} className={buttonVariants({ variant: action.variant ?? 'default' })}>
            {action.label}
          </Link>
        ) : (
          <Button variant={action.variant ?? 'default'} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
