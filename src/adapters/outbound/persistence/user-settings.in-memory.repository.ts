import { UserSettings } from '../../../core/domain/user-settings.js';
import { UserSettingsRepositoryPort } from '../../../core/ports/outbound/user-settings.repository.port.js';

export class InMemoryUserSettingsRepository implements UserSettingsRepositoryPort {
  private readonly store = new Map<string, UserSettings>();

  async get(userId: string): Promise<UserSettings | null> {
    const s = this.store.get(userId);
    return s ? { ...s, intolerances: [...s.intolerances] } : null;
  }

  async upsert(userId: string, settings: UserSettings): Promise<void> {
    this.store.set(userId, { ...settings, intolerances: [...settings.intolerances] });
  }
}
