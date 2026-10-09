import { addMonthsToDate } from '../dates';
import type { Installment, RawTransaction } from '../types';
import { cellText, parseAmount, parseDate, type Layout, type Row } from './table';

export interface ParsedRows {
  transactions: RawTransaction[];
  skipped: number;
}

/** "תשלום 3 מתוך 12", "3/12" – מחזיר את מספר התשלום והסך הכל. */
export function parseInstallment(...texts: string[]): Installment | undefined {
  for (const t of texts) {
    if (!t) continue;
    const m = /(?:תשלום\s*)?(\d{1,3})\s*(?:מתוך|\/|מ-)\s*(\d{1,3})/.exec(t);
    if (!m) continue;
    const index = Number(m[1]);
    const total = Number(m[2]);
    if (total >= 2 && total <= 120 && index >= 1 && index <= total) return { index, total };
  }
  return undefined;
}

/**
 * פירוק דפי פירוט של כרטיס אשראי (Max ופורמטים דומים).
 * סכום חיוב חיובי = הוצאה; סכום שלילי או "זיכוי" = כסף חוזר.
 * תשלומים: משויכים לחודש לפי תאריך החיוב (או נגזרים ממנו), כי כך הכסף באמת יוצא.
 */
export function parseCardRows(rows: Row[], layout: Layout): ParsedRows {
  const { cols, headerRow } = layout;
  const out: RawTransaction[] = [];
  let skipped = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const purchase = parseDate(row[cols.date!]);
    const desc = cellText(row[cols.desc!]);
    const raw =
      (cols.charge !== undefined ? parseAmount(row[cols.charge]) : null) ??
      (cols.amount !== undefined ? parseAmount(row[cols.amount]) : null) ??
      (cols.orig !== undefined ? parseAmount(row[cols.orig]) : null);
    if (!purchase || !desc || raw === null) {
      // שורות סיכום/הפרדה אינן שגיאה; רק שורות עם תוכן חלקי נספרות כדולגו
      if (row.some((c) => cellText(c) !== '') && (purchase || raw !== null)) skipped++;
      continue;
    }
    const type = cols.type !== undefined ? cellText(row[cols.type]) : '';
    const notes = cols.notes !== undefined ? cellText(row[cols.notes]) : '';
    const isCredit = /זיכוי|ביטול|החזר/.test(type) && raw > 0;
    const amount = isCredit ? Math.abs(raw) : -raw;
    if (amount === 0) continue;

    const installment = parseInstallment(notes, type);
    const charge = cols.chargeDate !== undefined ? parseDate(row[cols.chargeDate]) : null;
    let date = purchase;
    let purchaseDate: string | undefined;
    if (installment) {
      const orig = cols.orig !== undefined ? parseAmount(row[cols.orig]) : null;
      if (orig !== null && orig > 0) installment.originalAmount = orig;
      date = charge ?? addMonthsToDate(purchase, installment.index - 1);
      purchaseDate = purchase;
    }
    out.push({
      date,
      purchaseDate,
      description: desc,
      amount: Math.round(amount * 100) / 100,
      source: 'card',
      installment,
      note: notes && !installment ? notes : undefined,
      cardLast4: cols.card !== undefined ? cellText(row[cols.card]).replace(/\D/g, '').slice(-4) || undefined : undefined,
      sourceCategory: cols.category !== undefined ? cellText(row[cols.category]) || undefined : undefined,
    });
  }
  return { transactions: out, skipped };
}
