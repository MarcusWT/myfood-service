const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | null | undefined, fallback = '—'): string {
  const d = parse(iso);
  return d ? dateFmt.format(d) : fallback;
}

export function formatDateTime(iso: string | null | undefined, fallback = '—'): string {
  const d = parse(iso);
  return d ? dateTimeFmt.format(d) : fallback;
}

/** Local end of the chosen day ('YYYY-MM-DD') as an ISO string. */
export function toIsoEndOfDay(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59`).toISOString();
}

/** ISO string to a local 'YYYY-MM-DD' value for <input type="date">. */
export function toDateInput(iso: string | null | undefined): string {
  const d = parse(iso);
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
