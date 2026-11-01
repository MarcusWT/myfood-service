import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod';
import { DisposalHistoryService } from '../disposal-history.service.js';
import type { FoodItemRepositoryPort } from '../../core/ports/outbound/food-item.repository.port.js';

const NOW = new Date('2026-10-01T00:00:00.000Z');
const build = (rows: unknown[] = []) => {
  const getDisposalStats = vi.fn().mockResolvedValue(rows);
  const repo = { getDisposalStats } as unknown as FoodItemRepositoryPort;
  return { service: new DisposalHistoryService(repo, () => NOW), getDisposalStats };
};

describe('DisposalHistoryService.getWasteStats', () => {
  it('defaults to the last 90 days', async () => {
    const { service, getDisposalStats } = build();
    const res = await service.getWasteStats('u', {});
    expect(res.to).toBe(NOW.toISOString());
    expect(res.from).toBe(new Date(NOW.getTime() - 90 * 86_400_000).toISOString());
    expect(getDisposalStats).toHaveBeenCalledOnce();
  });

  it('rounds wasteRate to 4 decimals', async () => {
    const { service } = build([{ category: 'DAIRY', month: '2026-01', consumed: 2, discarded: 1 }]);
    expect((await service.getWasteStats('u', {})).totals.wasteRate).toBe(0.3333);
  });

  it('wasteRate is 0 when total is 0', async () => {
    const { service } = build();
    expect((await service.getWasteStats('u', {})).totals).toEqual({ consumed: 0, discarded: 0, total: 0, wasteRate: 0 });
  });

  it('rolls up totals, categories, months', async () => {
    const { service } = build([
      { category: 'DAIRY', month: '2026-09', consumed: 2, discarded: 1 },
      { category: 'DAIRY', month: '2026-08', consumed: 1, discarded: 0 },
      { category: 'MEAT', month: '2026-09', consumed: 0, discarded: 1 },
    ]);
    const res = await service.getWasteStats('u', {});
    expect(res.totals).toEqual({ consumed: 3, discarded: 2, total: 5, wasteRate: 0.4 });
    expect(res.byCategory).toEqual([
      { category: 'DAIRY', consumed: 3, discarded: 1 },
      { category: 'MEAT', consumed: 0, discarded: 1 },
    ]);
    expect(res.byMonth.map((m) => m.month)).toEqual(['2026-08', '2026-09']);
  });

  it('rejects from > to', async () => {
    const { service } = build();
    await expect(
      service.getWasteStats('u', { from: new Date('2026-10-02'), to: new Date('2026-10-01') }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
