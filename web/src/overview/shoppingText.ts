import { label } from '@/inventory/constants';
import { itemKey } from './useCheckedItems';
import { REASONS } from './reasons';

type Entry = { name: string; category: string; reason: string };

export function dedupeEntries<T extends Entry>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = itemKey(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function buildShoppingText(
  byCategory: Record<string, Entry[]>,
  isChecked: (key: string) => boolean,
  includeChecked: boolean,
): string {
  return Object.entries(byCategory)
    .map(([cat, items]) => {
      const lines = dedupeEntries(items)
        .filter((i) => includeChecked || !isChecked(itemKey(i)))
        .map((i) => `- ${i.name} (${REASONS[i.reason] ?? i.reason})`);
      return lines.length ? `${label(cat)}\n${lines.join('\n')}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}
