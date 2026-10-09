/** כל הפונקציות כאן עובדות על מחרוזות YYYY-MM-DD כדי להימנע מבעיות אזורי זמן. */

export const HEB_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];
export const HEB_MONTHS_SHORT = [
  'ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני',
  'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳',
];
export const HEB_WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function isValidYMD(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonthYM(y, m);
}

export function daysInMonthYM(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function parseISO(s: string): { y: number; m: number; d: number } {
  return { y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)), d: Number(s.slice(8, 10)) };
}

export const monthKey = (iso: string) => iso.slice(0, 7);

export function daysInMonth(key: string): number {
  return daysInMonthYM(Number(key.slice(0, 4)), Number(key.slice(5, 7)));
}

export function addMonths(key: string, n: number): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${pad2(mm + 1)}`;
}

/** מוסיף חודשים לתאריך מלא; אם היום לא קיים בחודש היעד מצמצם לסוף החודש. */
export function addMonthsToDate(iso: string, n: number): string {
  const { d } = parseISO(iso);
  const key = addMonths(monthKey(iso), n);
  return `${key}-${pad2(Math.min(d, daysInMonth(key)))}`;
}

export function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
}

export function dayNumber(iso: string): number {
  const { y, m, d } = parseISO(iso);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function diffDays(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

export function todayISO(now: Date = new Date()): string {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function monthLabel(key: string, withYear = true): string {
  const name = HEB_MONTHS[Number(key.slice(5, 7)) - 1];
  return withYear ? `${name} ${key.slice(0, 4)}` : name;
}

export function monthShort(key: string): string {
  return HEB_MONTHS_SHORT[Number(key.slice(5, 7)) - 1];
}

export function weekdayName(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return HEB_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 9.10.2026 */
export function formatDate(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return `${d}.${m}.${y}`;
}

/** 9.10 */
export function formatDayMonth(iso: string): string {
  const { m, d } = parseISO(iso);
  return `${d}.${m}`;
}

export function dayHeading(iso: string, today: string): string {
  const diff = diffDays(iso, today);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'אתמול';
  const { d, m } = parseISO(iso);
  return `${weekdayName(iso)}, ${d} ב${HEB_MONTHS[m - 1]}`;
}
