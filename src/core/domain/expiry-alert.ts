import { FoodItem } from './food-item.js';

export interface ExpiryAlert {
  item: FoodItem;
  daysUntilExpiry: number;
  status: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'UPCOMING';
}

/**
 * Derives an ExpiryAlert from a FoodItem.
 * EXPIRED   : already past best before
 * CRITICAL  : 0–2 days remaining
 * WARNING   : 3–5 days remaining
 * UPCOMING  : 6–N days remaining (within threshold)
 */
export function toExpiryAlert(item: FoodItem, now: Date = new Date()): ExpiryAlert {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilExpiry = Math.ceil((item.bestBefore.getTime() - now.getTime()) / msPerDay);

  let status: ExpiryAlert['status'];
  if (daysUntilExpiry < 0) {
    status = 'EXPIRED';
  } else if (daysUntilExpiry <= 2) {
    status = 'CRITICAL';
  } else if (daysUntilExpiry <= 5) {
    status = 'WARNING';
  } else {
    status = 'UPCOMING';
  }

  return { item, daysUntilExpiry, status };
}
