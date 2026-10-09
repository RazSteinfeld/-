import { getCategory } from './categories';
import { isValidYMD, parseISO } from './dates';
import { DEFAULT_SETTINGS, type BackupFile, type Settings, type Source, type Transaction } from './types';

export const BACKUP_APP_ID = 'hachnasot-vehotzaot' as const;

export function createBackup(transactions: Transaction[], settings: Settings, appVersion: string): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schema: 1,
    exportedAt: new Date().toISOString(),
    appVersion,
    settings,
    transactions,
  };
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `hachnasot-vehotzaot-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export class BackupError extends Error {}

const SOURCES: Source[] = ['card', 'bank', 'manual'];

function sanitizeTransaction(x: unknown): Transaction | null {
  if (!x || typeof x !== 'object') return null;
  const t = x as Record<string, unknown>;
  if (typeof t.id !== 'string' || !t.id) return null;
  if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return null;
  const { y, m, d } = parseISO(t.date);
  if (!isValidYMD(y, m, d)) return null;
  if (typeof t.amount !== 'number' || !Number.isFinite(t.amount)) return null;
  if (typeof t.description !== 'string') return null;
  const source = SOURCES.includes(t.source as Source) ? (t.source as Source) : 'manual';
  const category = typeof t.category === 'string' && getCategory(t.category).id === t.category ? t.category : 'other';
  const out: Transaction = {
    id: t.id,
    date: t.date,
    description: t.description,
    amount: t.amount,
    source,
    category,
    importedAt: typeof t.importedAt === 'string' ? t.importedAt : new Date().toISOString(),
  };
  if (typeof t.purchaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.purchaseDate)) out.purchaseDate = t.purchaseDate;
  if (t.locked === true) out.locked = true;
  if (typeof t.note === 'string' && t.note) out.note = t.note;
  if (typeof t.cardLast4 === 'string' && t.cardLast4) out.cardLast4 = t.cardLast4;
  const inst = t.installment as Record<string, unknown> | undefined;
  if (inst && typeof inst.index === 'number' && typeof inst.total === 'number') {
    out.installment = {
      index: inst.index,
      total: inst.total,
      ...(typeof inst.originalAmount === 'number' ? { originalAmount: inst.originalAmount } : {}),
    };
  }
  return out;
}

function sanitizeSettings(x: unknown): Settings {
  const s = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const rules: Record<string, string> = {};
  if (s.merchantRules && typeof s.merchantRules === 'object') {
    for (const [k, v] of Object.entries(s.merchantRules as Record<string, unknown>)) {
      if (typeof v === 'string' && getCategory(v).id === v) rules[k] = v;
    }
  }
  return {
    expectedIncome: typeof s.expectedIncome === 'number' && s.expectedIncome >= 0 ? s.expectedIncome : DEFAULT_SETTINGS.expectedIncome,
    merchantRules: rules,
    onboarded: s.onboarded === true,
  };
}

/** בודק ומנקה קובץ גיבוי. זורק BackupError עם הודעה ידידותית אם הוא לא תקין. */
export function parseBackup(text: string): { transactions: Transaction[]; settings: Settings; dropped: number; exportedAt?: string } {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new BackupError('הקובץ אינו קובץ גיבוי תקין (JSON פגום).');
  }
  const b = data as Partial<BackupFile> | null;
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP_ID) {
    throw new BackupError('זה לא קובץ גיבוי של האפליקציה "הכנסות והוצאות".');
  }
  if (b.schema !== 1) {
    throw new BackupError('גרסת הגיבוי חדשה מדי לאפליקציה הזו. עדכן את האפליקציה ונסה שוב.');
  }
  if (!Array.isArray(b.transactions)) throw new BackupError('בקובץ הגיבוי חסרות תנועות.');
  const seen = new Set<string>();
  const transactions: Transaction[] = [];
  let dropped = 0;
  for (const raw of b.transactions) {
    const t = sanitizeTransaction(raw);
    if (!t || seen.has(t.id)) {
      dropped++;
      continue;
    }
    seen.add(t.id);
    transactions.push(t);
  }
  return { transactions, settings: sanitizeSettings(b.settings), dropped, exportedAt: b.exportedAt };
}

/** ממזג גיבוי למאגר קיים: תנועות חדשות לפי ID מתווספות, קיימות נשארות. */
export function mergeBackup(
  existing: Transaction[],
  existingSettings: Settings,
  incoming: { transactions: Transaction[]; settings: Settings },
): { transactions: Transaction[]; settings: Settings; added: number } {
  const ids = new Set(existing.map((t) => t.id));
  const fresh = incoming.transactions.filter((t) => !ids.has(t.id));
  const transactions = [...existing, ...fresh].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
  return {
    transactions,
    settings: {
      expectedIncome: existingSettings.expectedIncome || incoming.settings.expectedIncome,
      merchantRules: { ...incoming.settings.merchantRules, ...existingSettings.merchantRules },
      onboarded: existingSettings.onboarded || incoming.settings.onboarded,
    },
    added: fresh.length,
  };
}
