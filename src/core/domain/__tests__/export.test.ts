import { describe, it, expect } from 'vitest';
import { escapeCsvCell, foodItemsToCsv } from '../export.js';
import type { FoodItem } from '../food-item.js';

const item = (o: Partial<FoodItem> = {}): FoodItem => ({
  id: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  name: 'Milk',
  quantity: 1,
  unit: 'LITRES',
  location: 'FRIDGE',
  category: 'DAIRY',
  bestBefore: new Date('2026-09-01T00:00:00.000Z'),
  addedAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...o,
});

describe('escapeCsvCell', () => {
  it.each([['=1+1'], ['+x'], ['-x'], ['@SUM(A1)'], ['\tfoo'], ['\rfoo'], [' =x'], ['\r=x']])(
    'guards %j',
    (v) => {
      expect(escapeCsvCell(v).replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );
  it('handles null, undefined, dates, numbers', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z');
    expect(escapeCsvCell(-5)).toBe('-5');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
    expect(escapeCsvCell('=a,b')).toBe('"\'=a,b"');
  });
  it('keeps unicode', () => {
    expect(escapeCsvCell('Crème brûlée 🍮')).toBe('Crème brûlée 🍮');
  });
});

describe('foodItemsToCsv', () => {
  it('has BOM, header, CRLF and no userId', () => {
    const csv = foodItemsToCsv([item({ name: 'A,"B"', notes: 'x\ny' })]);
    expect(csv.startsWith('\uFEFFid,name,quantity,unit,location,category,bestBefore,addedAt,updatedAt,notes,minimumQuantity\r\n')).toBe(true);
    expect(csv).not.toContain('22222222');
    expect(csv).toContain('"A,""B"""');
    expect(csv).toContain('"x\ny"');
    expect(csv.endsWith(',,')).toBe(false);
    expect(csv.split('\r\n')).toHaveLength(2);
  });
  it('leaves empty optionals blank', () => {
    const line = foodItemsToCsv([item()]).split('\r\n')[1];
    expect(line.endsWith(',,')).toBe(true);
  });
  it('header only for empty list', () => {
    expect(foodItemsToCsv([]).split('\r\n')).toHaveLength(1);
  });
});
