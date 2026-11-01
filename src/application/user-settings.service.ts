import { UserSettings, defaultUserSettings } from '../core/domain/user-settings.js';
import { UserSettingsServicePort } from '../core/ports/inbound/user-settings.service.port.js';
import { UserSettingsRepositoryPort } from '../core/ports/outbound/user-settings.repository.port.js';

export class UserSettingsService implements UserSettingsServicePort {
  constructor(private readonly repository: UserSettingsRepositoryPort) {}

  async getSettings(userId: string): Promise<UserSettings> {
    return (await this.repository.get(userId)) ?? defaultUserSettings();
  }

  async updateSettings(userId: string, settings: UserSettings): Promise<UserSettings> {
    await this.repository.upsert(userId, settings);
    return settings;
  }
}
