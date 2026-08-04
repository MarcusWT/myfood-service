import { ShoppingSummary } from '../../domain/shopping-summary.js';

export interface ShoppingSummaryServicePort {
  getSummary(): Promise<ShoppingSummary>;
}
