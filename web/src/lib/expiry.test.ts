import { daysUntil, expiryState, expiryText, statusText } from './expiry';

describe('expiry helpers', () => {
  it('computes days until with ceil semantics', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil('2026-01-01T00:00:00Z', now)).toBe(0);
    expect(daysUntil('2026-01-01T06:00:00Z', now)).toBe(1);
    expect(daysUntil('2025-12-30T00:00:00Z', now)).toBe(-2);
  });

  it('classifies states', () => {
    expect(expiryState(null)).toBe('none');
    expect(expiryState(-1)).toBe('expired');
    expect(expiryState(0)).toBe('today');
    expect(expiryState(3)).toBe('soon');
    expect(expiryState(4)).toBe('ok');
    expect(expiryState(5, 7)).toBe('soon');
  });

  it('pins text outputs', () => {
    expect(expiryText(-2)).toBe('Expired 2d ago');
    expect(expiryText(0)).toBe('Expires today');
    expect(expiryText(3)).toBe('Expires in 3d');
    expect(statusText('EXPIRED', -2)).toBe('Expired 2d ago');
    expect(statusText('CRITICAL', 0)).toBe('Expires today');
    expect(statusText('WARNING', 3)).toBe('Expires in 3d');
  });
});
