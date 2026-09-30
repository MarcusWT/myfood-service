import { describe, it, expect } from 'vitest';
import { InMemoryHealthCheckAdapter } from '../health-check.in-memory.adapter.js';

describe('InMemoryHealthCheckAdapter', () => {
  it('always reports ready', async () => {
    const adapter = new InMemoryHealthCheckAdapter();

    await expect(adapter.checkReadiness()).resolves.toBe(true);
  });
});
