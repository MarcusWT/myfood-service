import { foodItemsToCsv } from '../core/domain/export.js';
import {
  ExportFormat,
  ExportResult,
  ExportServicePort,
} from '../core/ports/inbound/export.service.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';

export class ExportService implements ExportServicePort {
  constructor(private readonly repository: FoodItemRepositoryPort) {}

  async exportFoodItems(userId: string, format: ExportFormat): Promise<ExportResult> {
    const items = await this.repository.findAll(userId);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    if (format === 'csv') {
      return {
        contentType: 'text/csv; charset=utf-8',
        filename: `myfood-export-${date}.csv`,
        body: foodItemsToCsv(items),
      };
    }
    return {
      contentType: 'application/json; charset=utf-8',
      filename: `myfood-export-${date}.json`,
      body: JSON.stringify({ exportedAt: now.toISOString(), count: items.length, items }),
    };
  }
}
