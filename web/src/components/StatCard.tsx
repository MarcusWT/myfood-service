import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_CLASSES: Record<StatTone, string> = {
  primary: 'bg-primary/15 text-primary',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-destructive/15 text-destructive',
  info: 'bg-chart-3/15 text-chart-3',
  neutral: 'bg-muted text-muted-foreground',
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  to?: string;
  hint?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  to,
  hint,
  className,
}: StatCardProps) {
  const body = (
    <CardContent className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg',
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>{' '}
        <span className="block text-2xl leading-tight font-semibold tabular-nums">{value}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </CardContent>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card interactive className={className}>
          {body}
        </Card>
      </Link>
    );
  }
  return <Card className={className}>{body}</Card>;
}
