import { z } from 'zod';

export const NOTIFICATION_CHANNELS = ['console', 'webhook'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DIETS = [
  'gluten free',
  'ketogenic',
  'vegetarian',
  'lacto-vegetarian',
  'ovo-vegetarian',
  'vegan',
  'pescetarian',
  'paleo',
  'primal',
  'low FODMAP',
  'whole30',
] as const;
export type Diet = (typeof DIETS)[number];

export const INTOLERANCES = [
  'dairy',
  'egg',
  'gluten',
  'grain',
  'peanut',
  'seafood',
  'sesame',
  'shellfish',
  'soy',
  'sulfite',
  'tree nut',
  'wheat',
] as const;
export type Intolerance = (typeof INTOLERANCES)[number];

export const UserSettingsSchema = z
  .object({
    alertWithinDays: z.number().int().min(1).max(365).nullable(),
    diet: z.enum(DIETS).nullable(),
    intolerances: z
      .array(z.enum(INTOLERANCES))
      .max(12)
      .transform((list) => [...new Set(list)].sort()),
    channel: z.enum(NOTIFICATION_CHANNELS),
  })
  .strict();

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export function defaultUserSettings(): UserSettings {
  return { alertWithinDays: null, diet: null, intolerances: [], channel: 'console' };
}
