import { ExpiryAlert, toExpiryAlert } from '../core/domain/expiry-alert.js';
import { ExpiryAlertServicePort } from '../core/ports/inbound/expiry-alert.service.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';

export class ExpiryAlertService implements ExpiryAlertServicePort {
  constructor(private readonly repository: FoodItemRepositoryPort) {}

  async getAlerts(withinDays: number = 7): Promise<ExpiryAlert[]> {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + withinDays);

    const allItems = await this.repository.findAll();
    return allItems
      .filter((item) => item.bestBefore <= threshold)
      .map((item) => toExpiryAlert(item, now))
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }
}
