import { getCategory } from './categories';
import { normalizeMerchant } from './categorize';
import { monthKey } from './dates';
import { fmtMoney } from './format';
import {
  averages,
  flowOf,
  monthlyEquivalent,
  type Averages,
  type MonthSummary,
} from './insights';
import type { Transaction } from './types';

export type Effort = 'קל' | 'בינוני' | 'דורש מאמץ';

export interface Opportunity {
  id: string;
  categoryId: string;
  title: string;
  /** מה זיהינו בנתונים */
  insight: string;
  monthlyAmount: number;
  potentialMonthly: number;
  effort: Effort;
  steps: string[];
  /** החודש הנבחר גבוה משמעותית מהממוצע */
  aboveAverage: boolean;
}

interface Playbook {
  categoryId: string;
  title: string;
  /** חיסכון ריאלי כאחוז מההוצאה החודשית בקטגוריה */
  pct: number;
  /** סף מינימלי (₪ בחודש) כדי שהמלצה תהיה שווה את המאמץ */
  min: number;
  effort: Effort;
  steps: string[];
}

const PLAYBOOKS: Playbook[] = [
  {
    categoryId: 'delivery', title: 'פחות משלוחי אוכל', pct: 0.35, min: 80, effort: 'בינוני',
    steps: [
      'הגדר לעצמך תקרה של 2–3 משלוחים בחודש',
      'במשלוח עצמי (Take Away) אין דמי משלוח ולרוב המחיר נמוך יותר',
      'הכן מראש ארוחת ערב פשוטה לימים העמוסים',
      'בדוק אם מנוי משלוחים (כמו וולט+) באמת משתלם לפי מספר ההזמנות שלך',
    ],
  },
  {
    categoryId: 'dining', title: 'ארוחות וקפה בחוץ', pct: 0.2, min: 200, effort: 'בינוני',
    steps: [
      'החלף חלק מהקפה היומי בקפה מהבית או במכל תרמי',
      'בצהריים – הבא אוכל מהבית פעמיים בשבוע',
      'בחר מסעדות עם עסקיות צהריים במקום ארוחת ערב',
      'נצל הטבות מועדון והנחות באשראי לפני שמזמינים',
    ],
  },
  {
    categoryId: 'groceries', title: 'חיסכון בקניות סופר', pct: 0.08, min: 800, effort: 'קל',
    steps: [
      'קנה לפי רשימה, ולא כשאתה רעב',
      'השווה מחירים באפליקציות כמו שופרסל/רמי לוי ובחר מותגי רשת',
      'תכנן קניות גדולות לפי מבצעים ובדוק קופונים במועדון הרשת',
      'הקפא לחם, ירקות ובשר לפני שהם מתקלקלים – כל מוצר שנזרק הוא כסף שנזרק',
    ],
  },
  {
    categoryId: 'subscriptions', title: 'מנויים וסטרימינג', pct: 0.3, min: 40, effort: 'קל',
    steps: [
      'עבור על כל מנוי ושאל: השתמשתי בו בחודש האחרון?',
      'בטל מנויים כפולים (למשל שתי פלטפורמות סטרימינג) – אפשר להחליף ביניהן כל כמה חודשים',
      'עבור לחבילה משפחתית או משותפת במקום מנויים נפרדים',
      'בטל תקופות ניסיון לפני שהן מתחילות לחייב',
    ],
  },
  {
    categoryId: 'telecom', title: 'סלולר ואינטרנט', pct: 0.25, min: 150, effort: 'בינוני',
    steps: [
      'התקשר לשירות לקוחות ובקש "הצעת שימור" – לרוב מקבלים הנחה משמעותית',
      'בדוק חברות לואו-קוסט (גולן, הוט מובייל, 019) לסלולר',
      'השווה חבילת אינטרנט וטלוויזיה בין הספקים לפני חידוש חוזה',
      'בטל שירותים נלווים שלא הזמנת (ביטוח מכשיר, חבילות תוכן)',
    ],
  },
  {
    categoryId: 'insurance', title: 'ביטוחים', pct: 0.12, min: 300, effort: 'דורש מאמץ',
    steps: [
      'בדוק בהר הביטוח אם יש כפל ביטוחי (בריאות, חיים, תאונות אישיות)',
      'קבל הצעות לביטוח רכב ודירה מכמה גורמים לפני החידוש',
      'העלה השתתפות עצמית אם אתה מוכן לקחת סיכון קטן',
      'בדוק אם אפשר לאחד פוליסות אצל אותו מבטח להנחה',
    ],
  },
  {
    categoryId: 'fees', title: 'עמלות וריבית', pct: 0.7, min: 20, effort: 'קל',
    steps: [
      'בקש מהבנק לבטל או להפחית עמלות – לרוב אפשר לנהל משא ומתן',
      'הימנע ממשיכות יתר: התראה כשהיתרה נמוכה מונעת ריבית חובה',
      'העבר פעולות לערוצים דיגיטליים, שם העמלה נמוכה או אפסית',
      'בדוק מסלול חשבון חינמי לפי הפעילות שלך',
    ],
  },
  {
    categoryId: 'car', title: 'רכב ודלק', pct: 0.1, min: 500, effort: 'בינוני',
    steps: [
      'תדלק בתחנות עם הנחות מועדון/אשראי ובשירות עצמי',
      'בדוק לחץ אוויר בצמיגים – חוסך דלק',
      'הימנע מחניונים בתשלום; השתמש באפליקציית חניה עם תעריף יומי',
      'שלב נסיעות משותפות או תחבורה ציבורית פעם-פעמיים בשבוע',
    ],
  },
  {
    categoryId: 'shopping', title: 'קניות ואלקטרוניקה', pct: 0.15, min: 300, effort: 'בינוני',
    steps: [
      'קבע כלל המתנה של 48 שעות לפני כל קנייה שאינה הכרחית',
      'השווה מחירים באתרי השוואה ובדוק קודי קופון',
      'קנה בתקופות מבצעים (בלאק פריידיי, סוף עונה)',
      'בדוק יד שנייה לפני קנייה של פריטים יקרים',
    ],
  },
  {
    categoryId: 'clothing', title: 'ביגוד והנעלה', pct: 0.2, min: 250, effort: 'בינוני',
    steps: [
      'קנה בסוף עונה ובמבצעי מועדון',
      'בדוק את הארון לפני שקונים – ויש הרבה "כמעט זהה"',
      'קבע תקציב רבעוני לביגוד',
    ],
  },
  {
    categoryId: 'leisure', title: 'פנאי ובידור', pct: 0.12, min: 300, effort: 'בינוני',
    steps: [
      'בדוק אם מנוי לחדר כושר שאתה לא מנצל שווה את העלות',
      'חפש הנחות לכרטיסים במועדוני צרכנים וקופות חולים',
      'שלב פעילויות חינמיות: טבע, פארקים, אירועי עירייה',
    ],
  },
  {
    categoryId: 'travel', title: 'נסיעות וחופשות', pct: 0.1, min: 600, effort: 'דורש מאמץ',
    steps: [
      'הזמן טיסות ומלונות מוקדם והשווה בכמה אתרים',
      'בדוק תאריכים גמישים – אמצע שבוע זול משמעותית',
      'השתמש בנקודות אשראי/מועדון לפני תשלום מלא',
    ],
  },
  {
    categoryId: 'utilities', title: 'חשמל, מים וגז', pct: 0.08, min: 400, effort: 'קל',
    steps: [
      'כבה מכשירים במצב המתנה ועבור לנורות לד',
      'בדוק אם תעריף שעות לילה (חשמל) מתאים לך',
      'תקן נזילות – טפטוף קטן הוא מאות שקלים בשנה',
    ],
  },
];

export interface RecurringItem {
  key: string;
  name: string;
  categoryId: string;
  monthly: number;
  months: number;
  /** נכנס בבירור תחת "מנויים/תקשורת" */
  isSubscription: boolean;
  lastDate: string;
}

const SUBSCRIPTION_CATS = new Set(['subscriptions', 'telecom']);
const NOT_RECURRING_CATS = new Set(['groceries', 'dining', 'delivery', 'car', 'transport', 'cash', 'shopping', 'clothing', 'other', 'fees']);

/** מזהה חיובים חוזרים: אותו בית עסק, בכמה חודשים שונים, בסכום דומה. */
export function detectRecurring(txs: Transaction[]): RecurringItem[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    const f = flowOf(t);
    if (f.kind !== 'expense' || f.value <= 0) continue;
    const key = normalizeMerchant(t.description);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  const out: RecurringItem[] = [];
  for (const [key, list] of groups) {
    const months = new Set(list.map((t) => monthKey(t.date)));
    const catCounts = new Map<string, number>();
    for (const t of list) catCounts.set(t.category, (catCounts.get(t.category) ?? 0) + 1);
    const categoryId = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const isSub = SUBSCRIPTION_CATS.has(categoryId);
    if (!isSub && (months.size < 3 || NOT_RECURRING_CATS.has(categoryId))) continue;
    // סכום חודשי טיפוסי = חציון של סכומי החודשים
    const perMonth = new Map<string, number>();
    for (const t of list) perMonth.set(monthKey(t.date), (perMonth.get(monthKey(t.date)) ?? 0) + -t.amount);
    const amounts = [...perMonth.values()].sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    if (median < 8 || median > 1500) continue;
    if (!isSub) {
      const spread = (amounts[amounts.length - 1] - amounts[0]) / median;
      if (spread > 0.35) continue; // סכום משתנה מדי – כנראה לא חיוב קבוע
    }
    const sorted = [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
    out.push({
      key,
      name: sorted[0].description,
      categoryId,
      monthly: median,
      months: months.size,
      isSubscription: isSub,
      lastDate: sorted[0].date,
    });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

export interface Comparison {
  categoryId: string;
  current: number;
  average: number;
  delta: number;
  deltaPct: number;
}

export interface SavingsReport {
  baseMonthlyExpense: number;
  basedOnMonths: number;
  /** הבסיס מנורמל מחודשים חלקיים – פחות מדויק */
  estimated: boolean;
  potentialMonthly: number;
  potentialYearly: number;
  opportunities: Opportunity[];
  recurring: RecurringItem[];
  recurringMonthly: number;
  comparisons: Comparison[];
  savingsRate: number | null;
  avg: Averages | null;
  /** החודש הנבחר חלקי, ולכן הממוצע מותאם יחסית למספר הימים שמכוסים */
  proRatedDays: number | null;
}

export function buildSavings(
  txs: Transaction[],
  months: MonthSummary[],
  selected: MonthSummary | null,
): SavingsReport {
  const avg = averages(months, undefined);
  const recurring = detectRecurring(txs);
  const empty: SavingsReport = {
    baseMonthlyExpense: 0, basedOnMonths: 0, estimated: false, potentialMonthly: 0, potentialYearly: 0,
    opportunities: [], recurring, recurringMonthly: recurring.reduce((a, r) => a + r.monthly, 0),
    comparisons: [], savingsRate: null, avg, proRatedDays: null,
  };
  if (!avg) {
    // אין בסיס שלם – ננסה לפחות לנרמל את החודש הנבחר
    if (!selected || selected.coveredDays < 7 || selected.expense <= 0) return empty;
  }
  const base: Record<string, number> = avg
    ? avg.byCategory
    : Object.fromEntries(Object.entries(selected!.byCategory).map(([k, v]) => [k, monthlyEquivalent(v, selected!)]));
  const baseTotal = avg ? avg.expense : monthlyEquivalent(selected!.expense, selected!);
  const opportunities: Opportunity[] = [];
  // בחודש חלקי משווים לממוצע יחסי למספר הימים שמכוסים (לא לחודש שלם)
  const factor = selected && selected.partial && selected.coveredDays > 0 ? selected.coveredDays / selected.daysInMonth : 1;
  for (const pb of PLAYBOOKS) {
    const monthly = base[pb.categoryId] ?? 0;
    if (monthly < pb.min) continue;
    const cur = selected?.byCategory[pb.categoryId] ?? 0;
    const avgCat = (avg?.byCategory[pb.categoryId] ?? 0) * factor;
    const above = !!selected && avgCat > 0 && cur > avgCat * 1.2 && cur - avgCat > 40;
    let insight = `בממוצע ${fmtMoney(monthly)} בחודש`;
    if (above) insight = `החודש ${fmtMoney(cur)}, גבוה מהממוצע שלך (${fmtMoney(avgCat)})`;
    opportunities.push({
      id: pb.categoryId,
      categoryId: pb.categoryId,
      title: pb.title,
      insight,
      monthlyAmount: monthly,
      potentialMonthly: monthly * pb.pct,
      effort: pb.effort,
      steps: pb.steps,
      aboveAverage: above,
    });
  }
  opportunities.sort((a, b) => b.potentialMonthly - a.potentialMonthly);

  const potentialMonthly = opportunities.reduce((a, o) => a + o.potentialMonthly, 0);

  const comparisons: Comparison[] = [];
  if (selected && avg) {
    const ids = new Set([...Object.keys(selected.byCategory), ...Object.keys(avg.byCategory)]);
    for (const id of ids) {
      if (getCategory(id).kind !== 'expense') continue;
      const cur = selected.byCategory[id] ?? 0;
      const a = (avg.byCategory[id] ?? 0) * factor;
      if (Math.max(cur, a) < 50) continue;
      const delta = cur - a;
      comparisons.push({ categoryId: id, current: cur, average: a, delta, deltaPct: a > 0 ? (delta / a) * 100 : 100 });
    }
    comparisons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  const incomeBase = avg && avg.income > 0 ? avg.income : 0;
  const savingsRate = incomeBase > 0 ? ((incomeBase - baseTotal) / incomeBase) * 100 : null;

  return {
    baseMonthlyExpense: baseTotal,
    basedOnMonths: avg?.months ?? 0,
    estimated: avg ? avg.scaled : true,
    potentialMonthly,
    potentialYearly: potentialMonthly * 12,
    opportunities,
    recurring,
    recurringMonthly: recurring.reduce((a, r) => a + r.monthly, 0),
    comparisons: comparisons.slice(0, 8),
    savingsRate,
    avg,
    proRatedDays: factor < 1 && selected ? selected.coveredDays : null,
  };
}
