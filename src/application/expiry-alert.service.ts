import { expiryThreshold } from '../core/domain/food-item.js';
import { ExpiryAlert, toExpiryAlert } from '../core/domain/expiry-alert.js';
import { ExpiryAlertServicePort } from '../core/ports/inbound/expiry-alert.service.port.js';
import { FoodItemRepositoryPort } from '../core/ports/outbound/food-item.repository.port.js';
import { UserSettingsRepositoryPort } from '../core/ports/outbound/user-settings.repository.port.js';

export interface ExpiryAlertServiceOptions {
  settings?: UserSettingsRepositoryPort;
  defaultDays?: number;
}

export class ExpiryAlertService implements ExpiryAlertServicePort {
  private readonly settings?: UserSettingsRepositoryPort;
  private readonly defaultDays: number;

  constructor(
    private readonly repository: FoodItemRepositoryPort,
    options: ExpiryAlertServiceOptions = {},
  ) {
    this.settings = options.settings;
    this.defaultDays = options.defaultDays ?? 7;
  }

  /** Window precedence: explicit withinDays > user's alertWithinDays > options.fallbackDays > defaultDays. */
  async getAlerts(
    userId: string,
    withinDays?: number,
    options: { fallbackDays?: number } = {},
  ): Promise<ExpiryAlert[]> {
    const days = withinDays ?? (await this.resolveWindow(userId, options.fallbackDays));
    const now = new Date();
    const threshold = expiryThreshold(now, days);

    const allItems = await this.repository.findAll(userId);
    return allItems
      .filter((item) => item.bestBefore <= threshold)
      .map((item) => toExpiryAlert(item, now))
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  private async resolveWindow(userId: string, fallbackDays?: number): Promise<number> {
    const userDays = this.settings ? (await this.settings.get(userId))?.alertWithinDays : null;
    return userDays ?? fallbackDays ?? this.defaultDays;
  }
}
