import { addDays, addMonths, toLocalDateInput } from './dates';

describe('dates', () => {
  it('formats local dates without UTC shift', () => {
    expect(toLocalDateInput(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('adds days across month boundaries', () => {
    expect(toLocalDateInput(addDays(new Date(2026, 0, 30), 3))).toBe('2026-02-02');
    expect(toLocalDateInput(addDays(new Date(2026, 0, 1), 7))).toBe('2026-01-08');
  });
  it('clamps end-of-month when adding months', () => {
    expect(toLocalDateInput(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(toLocalDateInput(addMonths(new Date(2028, 0, 31), 1))).toBe('2028-02-29');
    expect(toLocalDateInput(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01-15');
  });
});
