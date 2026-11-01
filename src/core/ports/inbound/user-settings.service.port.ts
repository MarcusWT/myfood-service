import { UserSettings } from '../../domain/user-settings.js';

export interface UserSettingsServicePort {
  /** Effective settings; defaults when the user has never saved any. */
  getSettings(userId: string): Promise<UserSettings>;
  /** Full replace (idempotent). */
  updateSettings(userId: string, settings: UserSettings): Promise<UserSettings>;
}
