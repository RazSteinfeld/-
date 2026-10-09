import type { RawTransaction } from '../types';
import { cellText, parseAmount, parseDate, type Layout, type Row } from './table';
import type { ParsedRows } from './card';

/**
 * פירוק תנועות בחשבון בנק (מזרחי-טפחות ופורמטים דומים).
 * עמודות חובה/זכות, או עמודת סכום אחת עם סימן.
 */
export function parseBankRows(rows: Row[], layout: Layout): ParsedRows {
  const { cols, headerRow } = layout;
  const out: RawTransaction[] = [];
  let skipped = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const date = parseDate(row[cols.date!]);
    const desc = cellText(row[cols.desc!]);
    let amount: number | null = null;
    if (cols.debit !== undefined || cols.credit !== undefined) {
      const debit = cols.debit !== undefined ? parseAmount(row[cols.debit]) : null;
      const credit = cols.credit !== undefined ? parseAmount(row[cols.credit]) : null;
      if (debit !== null || credit !== null) amount = (credit ?? 0) - (debit ?? 0);
    } else if (cols.amount !== undefined) {
      amount = parseAmount(row[cols.amount]);
    }
    if (!date || !desc || amount === null) {
      if (row.some((c) => cellText(c) !== '') && (date || amount !== null)) skipped++;
      continue;
    }
    if (amount === 0) continue;
    const ref = cols.ref !== undefined ? cellText(row[cols.ref]) : '';
    out.push({
      date,
      description: desc,
      amount: Math.round(amount * 100) / 100,
      source: 'bank',
      note: ref ? `אסמכתא ${ref}` : undefined,
    });
  }
  return { transactions: out, skipped };
}
