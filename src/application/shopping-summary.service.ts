import { ShoppingSummary, buildShoppingSummary } from '../core/domain/shopping-summary.js';
import { ShoppingSummaryServicePort } from '../core/ports/inbound/shopping-summary.service.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';

export class ShoppingSummaryService implements ShoppingSummaryServicePort {
  constructor(private readonly repository: FoodItemRepositoryPort) {}

  async getSummary(): Promise<ShoppingSummary> {
    const items = await this.repository.findAll();
    return buildShoppingSummary(items);
  }
}
