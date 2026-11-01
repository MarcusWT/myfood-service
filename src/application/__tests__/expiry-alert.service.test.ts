import { describe, it, expect } from 'vitest';
import { ExpiryAlertService } from '../expiry-alert.service.js';
import { InMemoryFoodItemRepository } from '../../adapters/outbound/persistence/food-item.in-memory.repository.js';
import { InMemoryUserSettingsRepository } from '../../adapters/outbound/persistence/user-settings.in-memory.repository.js';
import { seedFoodItem } from '../../adapters/inbound/http/__tests__/test-app.js';

const day = 86_400_000;

async function setup() {
  const repo = new InMemoryFoodItemRepository();
  const settings = new InMemoryUserSettingsRepository();
  const userId = '22222222-2222-2222-2222-222222222222';
  await seedFoodItem(repo, { id: '11111111-1111-1111-1111-111111111111', name: 'A', userId, bestBefore: new Date(Date.now() + 2 * day) });
  await seedFoodItem(repo, { id: '11111111-1111-1111-1111-111111111112', name: 'B', userId, bestBefore: new Date(Date.now() + 6 * day) });
  await seedFoodItem(repo, { id: '11111111-1111-1111-1111-111111111113', name: 'C', userId, bestBefore: new Date(Date.now() + 20 * day) });
  return { repo, settings, userId };
}

describe('ExpiryAlertService window precedence', () => {
  it('uses explicit > user setting > fallback > default', async () => {
    const { repo, settings, userId } = await setup();
    const svc = new ExpiryAlertService(repo, { settings, defaultDays: 30 });
    expect(await svc.getAlerts(userId)).toHaveLength(3);
    expect(await svc.getAlerts(userId, undefined, { fallbackDays: 10 })).toHaveLength(2);
    await settings.upsert(userId, { alertWithinDays: 3, diet: null, intolerances: [], channel: 'console' });
    expect(await svc.getAlerts(userId, undefined, { fallbackDays: 10 })).toHaveLength(1);
    expect(await svc.getAlerts(userId, 25)).toHaveLength(3);
  });

  it('defaults to 7 days without options', async () => {
    const { repo, userId } = await setup();
    expect(await new ExpiryAlertService(repo).getAlerts(userId)).toHaveLength(2);
  });
});
