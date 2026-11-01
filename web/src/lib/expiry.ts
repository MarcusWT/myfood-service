export const EXPIRING_SOON_DAYS = 3;

export type ExpiryState = 'none' | 'expired' | 'today' | 'soon' | 'ok';

export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

export function expiryState(days: number | null, soonDays = EXPIRING_SOON_DAYS): ExpiryState {
  if (days === null || Number.isNaN(days)) return 'none';
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  return days <= soonDays ? 'soon' : 'ok';
}

export function expiryText(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  return days === 0 ? 'Expires today' : `Expires in ${days}d`;
}

export function statusText(status: string, days: number): string {
  if (status === 'EXPIRED') return `Expired ${Math.abs(days)}d ago`;
  return days === 0 ? 'Expires today' : `Expires in ${days}d`;
}
