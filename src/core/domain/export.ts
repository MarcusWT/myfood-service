import { FoodItem } from './food-item.js';

const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapes one CSV cell. Strings starting with a spreadsheet formula trigger
 * get a leading `'` (CSV injection guard), so this slightly alters string
 * data; JSON export is the lossless format. Then RFC 4180 quoting.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'string') {
    text = FORMULA_PREFIXES.some((p) => value.replace(/^ +/, '').startsWith(p)) ? `'${value}` : value;
  } else {
    text = String(value);
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_COLUMNS = [
  'id',
  'name',
  'quantity',
  'unit',
  'location',
  'category',
  'bestBefore',
  'addedAt',
  'updatedAt',
  'notes',
  'minimumQuantity',
] as const;

export function foodItemsToCsv(items: FoodItem[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const item of items) {
    lines.push(CSV_COLUMNS.map((col) => escapeCsvCell(item[col])).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}
