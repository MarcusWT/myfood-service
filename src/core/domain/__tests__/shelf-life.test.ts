import { describe, it, expect } from 'vitest';
import { CategorySchema, LocationSchema } from '../value-objects.js';
import { SHELF_LIFE_DAYS, suggestShelfLife } from '../shelf-life.js';

describe('SHELF_LIFE_DAYS', () => {
  it('covers every category x location with null or a positive integer', () => {
    for (const c of CategorySchema.options) {
      for (const l of LocationSchema.options) {
        const d = SHELF_LIFE_DAYS[c][l];
        expect(d === null || (Number.isInteger(d) && d > 0)).toBe(true);
      }
    }
  });
});

describe('suggestShelfLife', () => {
  it('adds days from the injected date at UTC midnight', () => {
    const r = suggestShelfLife('DAIRY', 'FRIDGE', new Date('2026-03-01T15:30:00Z'))!;
    expect(r.days).toBe(7);
    expect(r.suggestedBestBefore.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(r.source).toBe('default-table');
  });

  it('is unaffected by DST boundaries', () => {
    const r = suggestShelfLife('MEAT', 'FRIDGE', new Date('2026-03-28T12:00:00Z'))!;
    expect(r.suggestedBestBefore.toISOString()).toBe('2026-03-31T00:00:00.000Z');
    const r2 = suggestShelfLife('MEAT', 'FRIDGE', new Date('2026-10-24T23:59:00Z'))!;
    expect(r2.suggestedBestBefore.toISOString()).toBe('2026-10-27T00:00:00.000Z');
  });

  it('rolls over the year end', () => {
    const r = suggestShelfLife('DAIRY', 'FRIDGE', new Date('2026-12-30T10:00:00Z'))!;
    expect(r.suggestedBestBefore.toISOString()).toBe('2027-01-06T00:00:00.000Z');
  });

  it('returns null when not recommended', () => {
    expect(suggestShelfLife('MEAT', 'PANTRY')).toBeNull();
  });
});
