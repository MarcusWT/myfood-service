import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TtlCache } from '../ttl-cache.js';

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for a missing key', () => {
    const cache = new TtlCache<number>();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('stores and retrieves a value before expiry', () => {
    const cache = new TtlCache<string>();
    cache.set('a', 'value', 1000);
    expect(cache.get('a')).toBe('value');
  });

  it('expires a value after the TTL elapses', () => {
    const cache = new TtlCache<string>();
    cache.set('a', 'value', 1000);

    vi.advanceTimersByTime(1001);

    expect(cache.get('a')).toBeUndefined();
  });

  it('does not expire a value before the TTL elapses', () => {
    const cache = new TtlCache<string>();
    cache.set('a', 'value', 1000);

    vi.advanceTimersByTime(999);

    expect(cache.get('a')).toBe('value');
  });

  it('overwrites an existing value and resets its TTL', () => {
    const cache = new TtlCache<string>();
    cache.set('a', 'first', 1000);
    vi.advanceTimersByTime(500);
    cache.set('a', 'second', 1000);
    vi.advanceTimersByTime(500);

    expect(cache.get('a')).toBe('second');
  });

  it('deletes a key', () => {
    const cache = new TtlCache<string>();
    cache.set('a', 'value', 1000);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
  });

  it('clears all entries', () => {
    const cache = new TtlCache<string>();
    cache.set('a', '1', 1000);
    cache.set('b', '2', 1000);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('tracks size', () => {
    const cache = new TtlCache<string>();
    cache.set('a', '1', 1000);
    cache.set('b', '2', 1000);
    expect(cache.size).toBe(2);
  });
});
