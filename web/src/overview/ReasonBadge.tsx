import { Badge } from '@/components/ui/badge';
import { REASONS } from './reasons';

const VARIANTS: Record<string, 'destructive' | 'outline' | 'secondary'> = {
  EXPIRED: 'destructive',
  LOW_STOCK: 'outline',
  EXPIRING_SOON: 'secondary',
};

export function ReasonBadge({ reason }: { reason: string }) {
  return <Badge variant={VARIANTS[reason] ?? 'outline'}>{REASONS[reason] ?? reason}</Badge>;
}
