import { ShoppingSummary } from '../../domain/shopping-summary.js';

export interface ShoppingSummaryServicePort {
  getSummary(userId: string): Promise<ShoppingSummary>;
}
