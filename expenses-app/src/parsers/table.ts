import * as XLSX from 'xlsx';
import { isValidYMD, toISO } from '../dates';

export type Cell = string | number | boolean | Date | null | undefined;
export type Row = Cell[];

export interface Sheet {
  name: string;
  rows: Row[];
}

/** שגיאה שאפשר להציג למשתמש כמו שהיא. */
export class FriendlyError extends Error {}

/* ---------- קריאת הקובץ ---------- */

function decodeUtf8(bytes: Uint8Array): { text: string; ok: boolean } {
  let out = '';
  let ok = true;
  let i = 0;
  const n = bytes.length;
  while (i < n) {
    const b = bytes[i];
    let cp: number;
    let extra: number;
    if (b < 0x80) { cp = b; extra = 0; }
    else if (b >= 0xc2 && b < 0xe0) { cp = b & 0x1f; extra = 1; }
    else if (b >= 0xe0 && b < 0xf0) { cp = b & 0x0f; extra = 2; }
    else if (b >= 0xf0 && b < 0xf5) { cp = b & 0x07; extra = 3; }
    else { ok = false; out += '\ufffd'; i++; continue; }
    let valid = i + extra < n || extra === 0;
    for (let k = 1; valid && k <= extra; k++) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) valid = false;
      else cp = (cp << 6) | (c & 0x3f);
    }
    if (!valid) { ok = false; out += '\ufffd'; i++; continue; }
    out += String.fromCodePoint(cp);
    i += extra + 1;
  }
  return { text: out, ok };
}

/** windows-1255 (קידוד עברית ישן שבו בנקים עדיין מייצאים CSV) */
function decodeWin1255(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b >= 0xe0 && b <= 0xfa) out += String.fromCharCode(0x05d0 + (b - 0xe0));
    else if (b === 0xa4) out += '₪'; // ₪
    else if (b === 0xfd) out += '‎';
    else if (b === 0xfe) out += '‏';
    else out += ' ';
  }
  return out;
}

export function decodeText(bytes: Uint8Array): string {
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  const view = start ? bytes.subarray(start) : bytes;
  const utf8 = decodeUtf8(view);
  if (utf8.ok) return utf8.text;
  return decodeWin1255(view);
}

function isBinaryWorkbook(b: Uint8Array): boolean {
  const zip = b[0] === 0x50 && b[1] === 0x4b; // PK – xlsx
  const ole = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0; // xls
  return zip || ole;
}

/** קורא xlsx / xls / csv / html-xls ומחזיר גיליונות כמערכי שורות גולמיים. */
export function readSheets(bytes: Uint8Array): Sheet[] {
  if (!bytes || bytes.length < 4) throw new FriendlyError('הקובץ ריק או פגום.');
  let wb: XLSX.WorkBook;
  try {
    wb = isBinaryWorkbook(bytes)
      ? XLSX.read(bytes, { type: 'array', raw: true, cellDates: false })
      : XLSX.read(decodeText(bytes), { type: 'string', raw: true, cellDates: false });
  } catch {
    throw new FriendlyError('לא הצלחתי לפתוח את הקובץ. ודא שזה קובץ Excel (xlsx / xls) או CSV.');
  }
  const sheets: Sheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, defval: '', blankrows: false });
    if (rows.length) sheets.push({ name, rows });
  }
  return sheets;
}

/* ---------- ערכים ---------- */

export const cellText = (c: Cell): string => {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return c.toISOString();
  return String(c).replace(/\s+/g, ' ').trim();
};

/** כותרת מנורמלת: בלי רווחים, גרשיים וסימני פיסוק. */
export const normHeader = (c: Cell): string =>
  cellText(c).replace(/[\s"'`׳״()[\].,:;\-_/\\*₪]/g, '').toLowerCase();

export function parseAmount(c: Cell): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  if (c === null || c === undefined) return null;
  let s = String(c).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[₪$€\s‎‏]/g, '').replace(/nis|ils|ש"ח|שח/gi, '');
  if (s.endsWith('-')) { neg = !neg; s = s.slice(0, -1); }
  if (s.startsWith('-') || s.startsWith('−')) { neg = !neg; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  // 1.234,56 (אירופי) מול 1,234.56
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return null;
  const v = parseFloat(s);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

/** מחזיר YYYY-MM-DD או null. תומך במספר סידורי של Excel, d/m/yyyy, d.m.yy, yyyy-mm-dd. */
export function parseDate(c: Cell): string | null {
  if (c === null || c === undefined || c === '') return null;
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return null;
    return toISO(c.getFullYear(), c.getMonth() + 1, c.getDate());
  }
  if (typeof c === 'number') {
    if (c < 20000 || c > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(c) * 86400000);
    return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(c).trim().replace(/[‎‏]/g, '');
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isValidYMD(y, mo, d) ? toISO(y, mo, d) : null;
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?!\d)/.exec(s);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (m[3].length === 2) y += 2000;
    return isValidYMD(y, mo, d) ? toISO(y, mo, d) : null;
  }
  return null;
}

/* ---------- זיהוי כותרות ---------- */

export type Role =
  | 'date' | 'chargeDate' | 'desc' | 'charge' | 'orig' | 'amount' | 'debit' | 'credit'
  | 'balance' | 'category' | 'card' | 'type' | 'notes' | 'ref';

const SYNONYMS: Record<Role, string[]> = {
  date: ['תאריךעסקה', 'תאריךרכישה', 'תאריך', 'תאריךפעולה', 'תאריךתנועה', 'תאריךהעסקה', 'יוםערך'],
  chargeDate: ['תאריךחיוב', 'מועדחיוב', 'תאריךהחיוב', 'תאריךתשלום'],
  desc: ['שםביתהעסק', 'שםביתעסק', 'ביתעסק', 'ביתהעסק', 'תיאור', 'תיאורהפעולה', 'תיאורפעולה', 'תיאורהתנועה', 'פרטים', 'תאור', 'תאורהפעולה', 'שםהעסק', 'פעולה', 'בתיעסק'],
  charge: ['סכוםחיוב', 'סכוםחיובבשח', 'סכוםהחיוב', 'סכוםבשח', 'סכוםחיובשח', 'חיובבשח'],
  orig: ['סכוםעסקהמקורי', 'סכוםעסקה', 'סכוםמקורי', 'סכוםהעסקה'],
  amount: ['סכום', 'סכוםהפעולה', 'סכוםהתנועה'],
  debit: ['חובה', 'חיוב', 'סכוםחובה', 'חובהבשח'],
  credit: ['זכות', 'סכוםזכות', 'זכותבשח'],
  balance: ['יתרה', 'יתרהבשח', 'יתרהבחשבון'],
  category: ['קטגוריה', 'ענף', 'קטגוריית'],
  card: ['4ספרותאחרונותשלכרטיסהאשראי', '4ספרותאחרונות', 'כרטיס', 'מספרכרטיס', '4ספרות', 'ספרותאחרונות'],
  type: ['סוגעסקה', 'סוגהעסקה', 'סוגפעולה', 'סוגהפעולה', 'אופןביצועהעסקה'],
  notes: ['הערות', 'פירוט', 'הערה', 'פרטינוספים'],
  ref: ['אסמכתא', 'אסמכתה', 'מספראסמכתא'],
};

export type Columns = Partial<Record<Role, number>>;

export interface Layout {
  headerRow: number;
  cols: Columns;
  kind: 'card' | 'bank';
}

function mapHeader(row: Row): Columns {
  const cols: Columns = {};
  const used = new Set<number>();
  const assign = (role: Role, exact: boolean) => {
    if (cols[role] !== undefined) return;
    const syn = SYNONYMS[role];
    for (let i = 0; i < row.length; i++) {
      if (used.has(i)) continue;
      const h = normHeader(row[i]);
      if (!h) continue;
      const hit = exact ? syn.includes(h) : syn.some((s) => s.length >= 4 && h.startsWith(s));
      if (hit) { cols[role] = i; used.add(i); return; }
    }
  };
  // סדר חשוב: התאמות מדויקות וספציפיות קודם
  const order: Role[] = ['chargeDate', 'charge', 'orig', 'debit', 'credit', 'balance', 'desc', 'date', 'category', 'card', 'type', 'notes', 'ref', 'amount'];
  for (const r of order) assign(r, true);
  for (const r of order) assign(r, false);
  return cols;
}

/** מוצא שורת כותרות בתוך 40 השורות הראשונות ומסווג: כרטיס אשראי או חשבון בנק. */
export function detectLayout(rows: Row[]): Layout | null {
  const limit = Math.min(rows.length, 40);
  let best: Layout | null = null;
  let bestScore = 0;
  for (let r = 0; r < limit; r++) {
    const row = rows[r];
    if (!row || row.filter((c) => cellText(c) !== '').length < 3) continue;
    const cols = mapHeader(row);
    if (cols.date === undefined || cols.desc === undefined) continue;
    const hasBank = cols.debit !== undefined || cols.credit !== undefined;
    const hasAmount = cols.charge !== undefined || cols.amount !== undefined || cols.orig !== undefined;
    if (!hasBank && !hasAmount) continue;
    const score = Object.keys(cols).length;
    if (score > bestScore) {
      bestScore = score;
      best = { headerRow: r, cols, kind: hasBank && !cols.charge ? 'bank' : 'card' };
    }
  }
  return best;
}
