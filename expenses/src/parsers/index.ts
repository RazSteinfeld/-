import { parseBankRows } from './bank';
import { parseCardRows } from './card';
import { detectLayout, FriendlyError, readSheets } from './table';
import type { RawTransaction, Source } from '../types';

export { FriendlyError } from './table';

export interface ParsedFile {
  fileName: string;
  /** 'card' = פירוט כרטיס אשראי (Max), 'bank' = תנועות בחשבון בנק (מזרחי) */
  kind: Source;
  transactions: RawTransaction[];
  skippedRows: number;
  sheets: number;
}

/** פותח קובץ Excel/CSV, מזהה אם הוא של כרטיס אשראי או בנק ומחזיר תנועות גולמיות. */
export function parseFile(fileName: string, bytes: Uint8Array): ParsedFile {
  const sheets = readSheets(bytes);
  const transactions: RawTransaction[] = [];
  let skipped = 0;
  let used = 0;
  const kinds = new Set<Source>();
  for (const sheet of sheets) {
    const layout = detectLayout(sheet.rows);
    if (!layout) continue;
    const res = layout.kind === 'bank' ? parseBankRows(sheet.rows, layout) : parseCardRows(sheet.rows, layout);
    if (!res.transactions.length && !res.skipped) continue;
    kinds.add(layout.kind);
    transactions.push(...res.transactions);
    skipped += res.skipped;
    used++;
  }
  if (!used) {
    throw new FriendlyError(
      'לא מצאתי בקובץ טבלת תנועות. ודא שזה קובץ שיוצא מאתר/אפליקציית Max או מהבנק (Excel או CSV) ושלא שונו בו הכותרות.',
    );
  }
  if (!transactions.length) {
    throw new FriendlyError('הקובץ נקרא, אבל לא נמצאו בו תנועות עם תאריך וסכום תקינים.');
  }
  return {
    fileName,
    kind: kinds.has('bank') && !kinds.has('card') ? 'bank' : 'card',
    transactions,
    skippedRows: skipped,
    sheets: used,
  };
}
