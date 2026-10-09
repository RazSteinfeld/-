/**
 * יוצר קובץ גיבוי עם נתוני דמו (אפריל–אוקטובר 2026) לבדיקת הממשק ולצילומי מסך.
 * הרצה: npx tsx scripts/make-demo-data.ts out.json
 * אפשר לשחזר אותו באפליקציה דרך "עוד ← שחזור מגיבוי".
 */
import fs from 'node:fs';
import { createBackup } from '../src/backup';
import { addMonths, daysInMonth } from '../src/dates';
import { mergeTransactions } from '../src/importer';
import { DEFAULT_SETTINGS, type RawTransaction } from '../src/types';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a: number, b: number) => Math.round((a + rnd() * (b - a)) * 100) / 100;
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

const raws: RawTransaction[] = [];
const card = (date: string, description: string, amount: number, sourceCategory?: string, extra: Partial<RawTransaction> = {}) =>
  raws.push({ date, description, amount: -amount, source: 'card', sourceCategory, ...extra });
const bank = (date: string, description: string, amount: number) => raws.push({ date, description, amount, source: 'bank' });

const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
for (const m of months) {
  const dim = daysInMonth(m);
  const last = m === '2026-10' ? 9 : dim;
  const d = (n: number) => `${m}-${String(Math.min(n, last)).padStart(2, '0')}`;
  bank(d(1), 'משכורת חברה בעמ', 14800);
  if (m === '2026-10') { /* שכר דירה בדרך */ } 
  bank(d(3), 'שכר דירה - העברה', -4800);
  if (last >= 10) bank(d(10), 'מקס איט פיננסים', -(4200 + Math.round(rnd() * 800)));
  if (last >= 15) bank(d(15), 'עמלת פעולה בערוץ ישיר', -12.5);
  if (last >= 20) bank(d(20), 'הפקדה לפיקדון', -1000);
  for (let i = 0; i < Math.min(8, Math.floor(last / 3.5)); i++) card(d(2 + i * 3), pick(['שופרסל דיל רמת גן', 'רמי לוי שיווק השקמה', 'יוחננוף', 'מגה בעיר']), between(120, 520), 'מזון וצריכה');
  for (let i = 0; i < Math.min(6, Math.floor(last / 5)); i++) card(d(3 + i * 4), pick(['ארומה תל אביב', 'קפה גרג', 'מסעדת אסיאתי', 'פיצה האט', 'לנדוור']), between(28, 180), 'מסעדות');
  for (let i = 0; i < Math.min(4, Math.floor(last / 7)); i++) card(d(5 + i * 6), 'WOLT TEL AVIV', between(70, 150), 'מסעדות');
  for (let i = 0; i < Math.min(3, Math.floor(last / 9)); i++) card(d(6 + i * 9), pick(['פז תחנת דלק', 'סונול', 'דור אלון']), between(220, 340), 'דלק, חשמל וגז');
  if (last >= 9) card(d(9), 'NETFLIX.COM', 54.9, 'פנאי, בידור וספורט');
  if (last >= 12) card(d(12), 'SPOTIFY', 24.9, 'פנאי, בידור וספורט');
  if (last >= 14) card(d(14), 'פרטנר תקשורת', 129.9, 'שירותי תקשורת');
  if (last >= 14) card(d(14), 'HOT אינטרנט', 99, 'שירותי תקשורת');
  if (last >= 22) card(d(22), 'הולמס פלייס', 289, 'פנאי, בידור וספורט');
  if (last >= 22) card(d(22), 'הפניקס ביטוח', 340, 'ביטוח');
  if (last >= 18 && rnd() > 0.35) card(d(18), pick(['זארה', 'קסטרו', 'H&M']), between(150, 480), 'אופנה');
  if (last >= 11) card(d(11), 'AMAZON EU', between(60, 380), 'קניות');
  if (last >= 16 && rnd() > 0.5) card(d(16), 'מכבי שירותי בריאות', between(30, 140), 'רפואה ובריאות');
  if (last >= 25 && rnd() > 0.5) card(d(25), 'סופר פארם', between(40, 160), 'רפואה ובריאות');
  if (last >= 4 && m === '2026-07') card(d(4), 'אל על נתיבי אוויר', 2390, 'תיירות');
}
// עסקת תשלומים: KSP, 12 תשלומים של 250 מאוגוסט
const inst = [['2026-08', 1], ['2026-09', 2], ['2026-10', 3]] as const;
for (const [m, i] of inst) {
  raws.push({ date: `${m}-10`, purchaseDate: '2026-07-20', description: 'KSP מחשבים', amount: -250, source: 'card', installment: { index: i, total: 12, originalAmount: 3000 }, sourceCategory: 'חשמל ואלקטרוניקה' });
}
void addMonths;

const { merged } = mergeTransactions([], raws, DEFAULT_SETTINGS, '2026-10-09T08:00:00.000Z');
const out = createBackup(merged, { ...DEFAULT_SETTINGS, expectedIncome: 14800, onboarded: true }, '1.0.0');
const path = process.argv[2] ?? 'demo-backup.json';
fs.writeFileSync(path, JSON.stringify(out));
console.log(`נוצר ${path}: ${merged.length} תנועות`);
