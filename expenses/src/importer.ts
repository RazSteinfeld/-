import { categorize, normalizeMerchant } from './categorize';
import type { RawTransaction, Settings, Transaction } from './types';

/** FNV-1a – מזהה קצר ויציב */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * מפתח בסיס של תנועה: מקור, תאריכים, סכום, שם בית עסק ומספר תשלום.
 * שתי תנועות זהות באותו יום (למשל שני קפה באותו סכום) מקבלות סיומת רצה.
 */
export function baseKey(t: Pick<RawTransaction, 'source' | 'date' | 'purchaseDate' | 'amount' | 'description' | 'installment'>): string {
  const inst = t.installment ? `${t.installment.index}/${t.installment.total}` : '';
  const desc = normalizeMerchant(t.description).replace(/\s/g, '');
  return `${t.source}|${t.date}|${t.purchaseDate ?? ''}|${Math.round(t.amount * 100)}|${desc}|${inst}`;
}

export interface MergeResult {
  merged: Transaction[];
  added: number;
  duplicates: number;
}

/** מזהה בסיס קצר ויציב לכל מפתח; ה-ID המלא הוא בסיס + מספר מופע. */
function idBase(key: string): string {
  return `${hash(key)}${key.length.toString(36)}`;
}

function baseOfId(id: string): string {
  return id.slice(0, id.lastIndexOf('-'));
}

/**
 * ממזג תנועות חדשות לקיימות בלי כפילויות. אם אותה תנועה מופיעה k פעמים בקובץ ו-j פעמים כבר
 * קיימות במאגר – מתווספות רק max(0, k-j), כך שייבוא חוזר או קבצים חופפים לא יוצרים כפילויות.
 */
export function mergeTransactions(
  existing: Transaction[],
  incoming: RawTransaction[],
  settings: Settings,
  now: string = new Date().toISOString(),
): MergeResult {
  const existingCount = new Map<string, number>();
  for (const t of existing) {
    const b = baseOfId(t.id);
    existingCount.set(b, (existingCount.get(b) ?? 0) + 1);
  }
  const seenInFile = new Map<string, number>();
  const added: Transaction[] = [];
  let duplicates = 0;
  for (const raw of incoming) {
    const base = idBase(baseKey(raw));
    const n = (seenInFile.get(base) ?? 0) + 1;
    seenInFile.set(base, n);
    if (n <= (existingCount.get(base) ?? 0)) {
      duplicates++;
      continue;
    }
    const { sourceCategory, ...rest } = raw;
    added.push({
      ...rest,
      id: `${base}-${n - 1}`,
      category: categorize({
        description: raw.description,
        amount: raw.amount,
        source: raw.source,
        sourceCategory,
        userRules: settings.merchantRules,
      }),
      importedAt: now,
    });
  }
  const merged = added.length ? [...existing, ...added] : existing;
  merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
  return { merged, added: added.length, duplicates };
}
