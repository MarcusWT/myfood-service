import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DisposedPurgeJob } from '../disposed-purge-job.js';
import type { FoodItemRepositoryPort } from '../../core/ports/outbound/food-item.repository.port.js';

describe('DisposedPurgeJob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('runs after the initial delay then every interval, with the retention cutoff', async () => {
    const purge = vi.fn().mockResolvedValue(0);
    const job = new DisposedPurgeJob({ purgeDisposedBefore: purge } as unknown as FoodItemRepositoryPort, 10, 1000, 60_000);
    job.start();
    job.start();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(purge).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(purge.mock.calls[0][0]).toEqual(new Date(Date.now() - 10 * 86_400_000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(purge).toHaveBeenCalledTimes(2);
    await job.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it('stop awaits the in-flight run', async () => {
    let release!: () => void;
    const purge = vi.fn().mockReturnValue(new Promise<number>((r) => (release = () => r(1))));
    const job = new DisposedPurgeJob({ purgeDisposedBefore: purge } as unknown as FoodItemRepositoryPort, 1, 1000, 10);
    job.start();
    await vi.advanceTimersByTimeAsync(10);
    let stopped = false;
    const p = job.stop().then(() => (stopped = true));
    await Promise.resolve();
    expect(stopped).toBe(false);
    release();
    await p;
    expect(stopped).toBe(true);
  });

  it('survives a failing purge', async () => {
    const purge = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(0);
    const job = new DisposedPurgeJob({ purgeDisposedBefore: purge } as unknown as FoodItemRepositoryPort, 1, 1000, 10);
    job.start();
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(1000);
    expect(purge).toHaveBeenCalledTimes(2);
    await job.stop();
  });
});
