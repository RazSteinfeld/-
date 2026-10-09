import { getCategory } from './categories';
import { normalizeMerchant } from './categorize';
import { addMonths, daysInMonth, monthKey, monthsBetween, parseISO, diffDays } from './dates';
import type { Transaction } from './types';

/* ---------- זרימת כסף ---------- */

export interface Flow {
  kind: 'income' | 'expense' | 'none';
  /** תמיד חיובי לתנועה "רגילה"; שלילי כשמדובר בזיכוי בתוך קטגוריית הוצאה/הכנסה */
  value: number;
}

/** העברות (חיוב אשראי, חיסכון, העברות פנימיות) לא נספרות בהכנסות ובהוצאות. */
export function flowOf(t: Pick<Transaction, 'amount' | 'category'>): Flow {
  const cat = getCategory(t.category);
  if (cat.kind === 'transfer') return { kind: 'none', value: 0 };
  if (cat.kind === 'income') return { kind: 'income', value: t.amount };
  return { kind: 'expense', value: -t.amount };
}

/* ---------- סיכומים חודשיים ---------- */

export interface MonthSummary {
  key: string;
  income: number;
  expense: number;
  net: number;
  /** הוצאות לפי קטגוריה */
  byCategory: Record<string, number>;
  count: number;
  daysInMonth: number;
  /** כמה ימים בחודש מכוסים בנתונים שיובאו */
  coveredDays: number;
  /** חודש חלקי: הנתונים לא מכסים את כולו */
  partial: boolean;
  /** החודש הקלנדרי הנוכחי (עוד לא נגמר) */
  ongoing: boolean;
  firstDate: string | null;
  lastDate: string | null;
}

export interface Summaries {
  months: MonthSummary[];
  range: { min: string; max: string } | null;
}

const EMPTY: Summaries = { months: [], range: null };

export function buildSummaries(txs: Transaction[], today: string): Summaries {
  if (!txs.length) return EMPTY;
  const nowKey = monthKey(today);
  // חיובים עתידיים (חודשים אחרי החודש הנוכחי) לא נחשבים להיסטוריה
  let min = '';
  let max = '';
  for (const t of txs) {
    if (monthKey(t.date) > nowKey) continue;
    if (!min || t.date < min) min = t.date;
    if (!max || t.date > max) max = t.date;
  }
  if (!min) return EMPTY;
  const lastKey = monthKey(max);
  const firstKey = monthKey(min);
  const span = monthsBetween(firstKey, lastKey);
  const map = new Map<string, MonthSummary>();
  for (let i = 0; i <= span; i++) {
    const key = addMonths(firstKey, i);
    const dim = daysInMonth(key);
    const startDay = key === monthKey(min) ? parseISO(min).d : 1;
    const endDay = key === monthKey(max) ? parseISO(max).d : dim;
    const covered = Math.max(0, Math.min(dim, endDay) - startDay + 1);
    map.set(key, {
      key,
      income: 0,
      expense: 0,
      net: 0,
      byCategory: {},
      count: 0,
      daysInMonth: dim,
      coveredDays: covered,
      partial: covered < dim - 2,
      ongoing: key === nowKey,
      firstDate: null,
      lastDate: null,
    });
  }
  for (const t of txs) {
    const s = map.get(monthKey(t.date));
    if (!s) continue;
    s.count++;
    if (!s.firstDate || t.date < s.firstDate) s.firstDate = t.date;
    if (!s.lastDate || t.date > s.lastDate) s.lastDate = t.date;
    const f = flowOf(t);
    if (f.kind === 'income') s.income += f.value;
    else if (f.kind === 'expense') {
      s.expense += f.value;
      s.byCategory[t.category] = (s.byCategory[t.category] ?? 0) + f.value;
    }
  }
  const months = [...map.values()];
  for (const s of months) s.net = s.income - s.expense;
  return { months, range: { min, max } };
}

/** חודש ברירת מחדל: האחרון שיש בו נתונים (לא אחרי החודש הנוכחי). */
export function defaultMonth(sum: Summaries): string | null {
  for (let i = sum.months.length - 1; i >= 0; i--) if (sum.months[i].count > 0) return sum.months[i].key;
  return sum.months.length ? sum.months[sum.months.length - 1].key : null;
}

/** הערכה חודשית שלמה מחודש חלקי (כשיש לפחות שבוע נתונים). */
export function monthlyEquivalent(amount: number, s: MonthSummary): number {
  if (s.partial && s.coveredDays >= 7) return (amount * s.daysInMonth) / s.coveredDays;
  return amount;
}

/** חודשים לבסיס השוואה: חודשים שלמים; ואם אין – חודשים חלקיים מנורמלים. */
export function baselineMonths(months: MonthSummary[], excludeKey?: string): { list: MonthSummary[]; scaled: boolean } {
  const usable = months.filter((m) => m.key !== excludeKey && m.count > 0 && !m.ongoing);
  const complete = usable.filter((m) => !m.partial);
  if (complete.length) return { list: complete, scaled: false };
  const partial = usable.filter((m) => m.coveredDays >= 7);
  return { list: partial, scaled: true };
}

export interface Averages {
  months: number;
  scaled: boolean;
  income: number;
  expense: number;
  byCategory: Record<string, number>;
}

export function averages(months: MonthSummary[], excludeKey?: string): Averages | null {
  const { list, scaled } = baselineMonths(months, excludeKey);
  if (!list.length) return null;
  const byCategory: Record<string, number> = {};
  let income = 0;
  let expense = 0;
  for (const m of list) {
    income += scaled ? monthlyEquivalent(m.income, m) : m.income;
    expense += scaled ? monthlyEquivalent(m.expense, m) : m.expense;
    for (const [c, v] of Object.entries(m.byCategory)) {
      byCategory[c] = (byCategory[c] ?? 0) + (scaled ? monthlyEquivalent(v, m) : v);
    }
  }
  const n = list.length;
  for (const c of Object.keys(byCategory)) byCategory[c] /= n;
  return { months: n, scaled, income: income / n, expense: expense / n, byCategory };
}

/* ---------- "כמה נשאר החודש" ---------- */

export interface Overview {
  summary: MonthSummary;
  incomeBasis: number;
  /** ההכנסה לחישוב היא הערכה (צפויה/ממוצע) ולא מה שנכנס בפועל */
  incomeEstimated: boolean;
  remaining: number;
  /** כמה אחוז מההכנסה כבר הוצא (0..∞) */
  spentRatio: number;
  daysLeft: number | null;
  dailyAllowance: number | null;
  projectedExpense: number | null;
}

export function monthOverview(
  summary: MonthSummary,
  months: MonthSummary[],
  expectedIncome: number,
  today: string,
): Overview {
  let incomeBasis = summary.income;
  let incomeEstimated = false;
  if (expectedIncome > 0 && expectedIncome > summary.income) {
    incomeBasis = expectedIncome;
    incomeEstimated = summary.income > 0 || summary.ongoing;
  } else if (summary.income <= 0) {
    const avg = averages(months, summary.key);
    if (avg && avg.income > 0) {
      incomeBasis = avg.income;
      incomeEstimated = true;
    }
  }
  const remaining = incomeBasis - summary.expense;
  const spentRatio = incomeBasis > 0 ? summary.expense / incomeBasis : summary.expense > 0 ? 1 : 0;
  let daysLeft: number | null = null;
  let dailyAllowance: number | null = null;
  let projectedExpense: number | null = null;
  if (summary.ongoing) {
    const day = parseISO(today).d;
    daysLeft = Math.max(0, summary.daysInMonth - day + 1);
    dailyAllowance = daysLeft > 0 ? Math.max(0, remaining) / daysLeft : 0;
    const elapsed = Math.max(1, Math.min(day, summary.lastDate ? parseISO(summary.lastDate).d : day));
    if (elapsed >= 3) projectedExpense = summary.expense + (summary.expense / elapsed) * daysLeft;
  }
  return { summary, incomeBasis, incomeEstimated, remaining, spentRatio, daysLeft, dailyAllowance, projectedExpense };
}

/* ---------- מגמה, קטגוריות, בתי עסק ---------- */

export function trend(months: MonthSummary[], endKey: string, n = 6): MonthSummary[] {
  const idx = months.findIndex((m) => m.key === endKey);
  if (idx < 0) return [];
  return months.slice(Math.max(0, idx - n + 1), idx + 1);
}

export interface CategorySlice {
  id: string;
  amount: number;
  pct: number;
}

export function categoryBreakdown(s: MonthSummary): CategorySlice[] {
  const entries = Object.entries(s.byCategory).filter(([, v]) => v > 0.5);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  return entries
    .map(([id, amount]) => ({ id, amount, pct: total ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export interface MerchantTotal {
  key: string;
  name: string;
  total: number;
  count: number;
  category: string;
}

export function merchantTotals(txs: Transaction[], predicate: (t: Transaction) => boolean): MerchantTotal[] {
  const map = new Map<string, MerchantTotal & { names: Map<string, number>; cats: Map<string, number> }>();
  for (const t of txs) {
    if (!predicate(t)) continue;
    const f = flowOf(t);
    if (f.kind !== 'expense') continue;
    const key = normalizeMerchant(t.description) || t.description;
    let m = map.get(key);
    if (!m) {
      m = { key, name: t.description, total: 0, count: 0, category: t.category, names: new Map(), cats: new Map() };
      map.set(key, m);
    }
    m.total += f.value;
    m.count++;
    m.names.set(t.description, (m.names.get(t.description) ?? 0) + 1);
    m.cats.set(t.category, (m.cats.get(t.category) ?? 0) + Math.abs(f.value));
  }
  const out: MerchantTotal[] = [];
  for (const m of map.values()) {
    m.name = [...m.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    m.category = [...m.cats.entries()].sort((a, b) => b[1] - a[1])[0][0];
    out.push({ key: m.key, name: m.name, total: m.total, count: m.count, category: m.category });
  }
  return out.filter((m) => m.total > 0).sort((a, b) => b.total - a.total);
}

export const topMerchants = (txs: Transaction[], month: string, n = 6) =>
  merchantTotals(txs, (t) => monthKey(t.date) === month).slice(0, n);

/* ---------- תשלומים עתידיים ---------- */

export interface InstallmentSeries {
  key: string;
  description: string;
  perMonth: number;
  paid: number;
  total: number;
  remainingPayments: number;
  remainingAmount: number;
  lastDate: string;
  category: string;
}

export interface Commitments {
  byMonth: { month: string; amount: number; items: number }[];
  totalRemaining: number;
  series: InstallmentSeries[];
}

/** תשלומים שעוד לא נגבו, לפי התשלום האחרון הידוע בכל עסקת תשלומים. */
export function installmentCommitments(txs: Transaction[], today: string): Commitments {
  const nowKey = monthKey(today);
  const latest = new Map<string, Transaction>();
  for (const t of txs) {
    if (!t.installment) continue;
    const key = `${normalizeMerchant(t.description)}|${t.purchaseDate ?? ''}|${t.installment.total}|${Math.round(Math.abs(t.amount) * 100)}`;
    const cur = latest.get(key);
    if (!cur || t.installment.index > cur.installment!.index) latest.set(key, t);
  }
  const byMonth = new Map<string, { amount: number; items: number }>();
  const series: InstallmentSeries[] = [];
  let totalRemaining = 0;
  for (const [key, t] of latest) {
    const inst = t.installment!;
    const per = Math.abs(t.amount);
    let remainingPayments = 0;
    if (monthKey(t.date) > nowKey) {
      // התשלום עצמו כבר מופיע בקובץ אבל ייגבה בחודש עתידי
      const cur = byMonth.get(monthKey(t.date)) ?? { amount: 0, items: 0 };
      cur.amount += per;
      cur.items++;
      byMonth.set(monthKey(t.date), cur);
      remainingPayments++;
    }
    for (let i = 1; i <= inst.total - inst.index; i++) {
      const month = addMonths(monthKey(t.date), i);
      if (month <= nowKey) continue;
      remainingPayments++;
      const cur = byMonth.get(month) ?? { amount: 0, items: 0 };
      cur.amount += per;
      cur.items++;
      byMonth.set(month, cur);
    }
    if (!remainingPayments) continue;
    totalRemaining += per * remainingPayments;
    series.push({
      key,
      description: t.description,
      perMonth: per,
      paid: inst.index,
      total: inst.total,
      remainingPayments,
      remainingAmount: per * remainingPayments,
      lastDate: t.date,
      category: t.category,
    });
  }
  return {
    byMonth: [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, v]) => ({ month, ...v })),
    totalRemaining,
    series: series.sort((a, b) => b.remainingAmount - a.remainingAmount),
  };
}

/** כמה ימים עברו מאז התנועה האחרונה (לתזכורת "הנתונים לא מעודכנים"). */
export function staleDays(range: { max: string } | null, today: string): number {
  if (!range) return 0;
  return Math.max(0, diffDays(range.max, today));
}
