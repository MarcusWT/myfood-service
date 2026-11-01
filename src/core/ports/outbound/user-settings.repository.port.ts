import { UserSettings } from '../../domain/user-settings.js';

export interface UserSettingsRepositoryPort {
  get(userId: string): Promise<UserSettings | null>;
  upsert(userId: string, settings: UserSettings): Promise<void>;
}
