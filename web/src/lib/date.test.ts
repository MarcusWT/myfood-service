import { formatDate, formatDateTime, toDateInput, toIsoEndOfDay } from './date';

describe('date helpers', () => {
  it('falls back for null and invalid input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('nope')).toBe('—');
    expect(formatDateTime(undefined, 'n/a')).toBe('n/a');
    expect(toDateInput('nope')).toBe('');
  });

  it('formats valid dates', () => {
    expect(formatDate('2026-03-05T12:00:00Z')).toMatch(/2026/);
    expect(formatDateTime('2026-03-05T12:00:00Z')).toMatch(/2026/);
  });

  it('round-trips the end of a local day', () => {
    const iso = toIsoEndOfDay('2026-03-05');
    expect(toDateInput(iso)).toBe('2026-03-05');
    expect(new Date(iso).getHours()).toBe(23);
  });
});
