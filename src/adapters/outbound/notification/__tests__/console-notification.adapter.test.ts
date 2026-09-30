import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleNotificationAdapter } from '../console-notification.adapter.js';
import { logger } from '../../../../logger.js';
import type { ExpiryAlert } from '../../../../core/domain/expiry-alert.js';
import type { FoodItem } from '../../../../core/domain/food-item.js';

const makeItem = (overrides?: Partial<FoodItem>): FoodItem => ({
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Eggs',
  quantity: 12,
  unit: 'UNITS',
  location: 'FRIDGE',
  category: 'OTHER',
  bestBefore: new Date('2026-09-01'),
  addedAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  ...overrides,
});

const makeAlert = (overrides?: Partial<ExpiryAlert>): ExpiryAlert => ({
  item: makeItem(),
  daysUntilExpiry: 1,
  status: 'CRITICAL',
  ...overrides,
});

describe('ConsoleNotificationAdapter', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('does nothing when there are no alerts', async () => {
    const adapter = new ConsoleNotificationAdapter();

    await adapter.notify([]);

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs one line per alert', async () => {
    const adapter = new ConsoleNotificationAdapter();
    const alerts = [
      makeAlert({ item: makeItem({ name: 'Eggs' }), status: 'CRITICAL', daysUntilExpiry: 1 }),
      makeAlert({ item: makeItem({ name: 'Milk' }), status: 'EXPIRED', daysUntilExpiry: -2 }),
    ];

    await adapter.notify(alerts);

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.stringContaining('CRITICAL'),
    );
    expect(logSpy).toHaveBeenNthCalledWith(1, expect.anything(), expect.stringContaining('Eggs'));
    expect(logSpy).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.stringContaining('EXPIRED'),
    );
    expect(logSpy).toHaveBeenNthCalledWith(2, expect.anything(), expect.stringContaining('Milk'));
  });
});
