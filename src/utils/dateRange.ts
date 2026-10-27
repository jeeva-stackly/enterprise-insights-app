import type { DateRange, PeriodKey } from '@/types/analytics';

/**
 * The backend works in UTC calendar days, so the preset filters are computed from the UTC date.
 * That way "Today" always means the same day the server aggregates.
 */
const MAX_DAYS = 366;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date -> YYYY-MM-DD using the *local* calendar day (what a date picker returns). */
export function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's date in UTC as YYYY-MM-DD. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((parse(end).getTime() - parse(start).getTime()) / 86_400_000) + 1;
}

/** YYYY-MM-DD -> a Date at local noon (safe from timezone day-shifts) for the date picker. */
export function isoToPickerDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function rangeForPeriod(key: Exclude<PeriodKey, 'custom'>, now: Date = new Date()): DateRange {
  const today = utcToday(now);
  switch (key) {
    case 'today':
      return { start: today, end: today };
    case 'last7':
      return { start: addDays(today, -6), end: today };
    case 'last30':
      return { start: addDays(today, -29), end: today };
    case 'thisMonth':
      return { start: `${today.slice(0, 8)}01`, end: today };
  }
}

/** Latest date a custom range may end on: the later of the UTC and local "today". */
export function maxSelectableDate(now: Date = new Date()): string {
  const utc = utcToday(now);
  const local = localIso(now);
  return local > utc ? local : utc;
}

/** Returns a user-facing message, or null when the custom range is valid. */
export function validateCustomRange(start: string | null, end: string | null, now: Date = new Date()): string | null {
  if (!start || !end) return 'Please choose both a start and an end date.';
  if (start > end) return 'The start date must be on or before the end date.';
  if (end > maxSelectableDate(now)) return 'The end date cannot be in the future.';
  if (daysBetween(start, end) > MAX_DAYS) return `Please choose a range of ${MAX_DAYS} days or fewer.`;
  return null;
}

/** "12 Oct 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "12 Oct" (no year) */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function formatRange(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatShortDate(start)} – ${formatDate(end)}`;
}

/** Trend bucket -> axis label: "14:00" stays, "2026-10-12" becomes "12 Oct". */
export function formatBucket(bucket: string): string {
  return bucket.includes(':') ? bucket : formatShortDate(bucket);
}