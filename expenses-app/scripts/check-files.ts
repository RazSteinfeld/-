/**
 * בדיקת הפירוק והלוגיקה בלי לפתוח את האפליקציה.
 *
 * הרצה:   npm run check-files                (בדיקות עם קבצים סינתטיים)
 *         npm run check-files -- path/a.xlsx path/b.csv   (פירוק קבצים אמיתיים והדפסת סיכום)
 *
 * אם קיימת תיקיית samples/ בשורש הפרויקט, כל הקבצים שבה ייבדקו אוטומטית.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { buildSavings } from '../src/advice';
import { mergeBackup, parseBackup, createBackup } from '../src/backup';
import { addMonths } from '../src/dates';
import { mergeTransactions } from '../src/importer';
import {
  buildSummaries, categoryBreakdown, defaultMonth, installmentCommitments, monthOverview, topMerchants,
} from '../src/insights';
import { parseFile } from '../src/parsers';
import { parseAmount, parseDate } from '../src/parsers/table';
import { CATEGORIES, getCategory } from '../src/categories';
import { DEFAULT_SETTINGS, type Transaction } from '../src/types';

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}`, detail ?? '');
  }
}
const toBytes = (b: Buffer | Uint8Array) => new Uint8Array(b);

/* ---------- קבצים סינתטיים בפורמט דומה ל-Max ולבנק מזרחי ---------- */

const TODAY = '2026-10-09';

function maxWorkbook(): Uint8Array {
  const header = [
    'תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב',
    'מטבע חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי', 'תאריך חיוב', 'הערות',
  ];
  const rows: unknown[][] = [
    ['פירוט עסקאות לתאריכים 01/08/2026 - 09/10/2026'],
    ['כרטיס אשראי מסתיים ב-1234'],
    [],
    header,
  ];
  const add = (date: string, name: string, cat: string, type: string, amt: number, bill: string, notes = '', orig = amt) =>
    rows.push([date, name, cat, '1234', type, amt, '₪', orig, '₪', bill, notes]);
  // אוגוסט – חודש שלם
  add('02-08-2026', 'שופרסל דיל רמת גן', 'מזון וצריכה', 'רגילה', 412.3, '10-09-2026');
  add('05-08-2026', 'WOLT TEL AVIV', 'מסעדות', 'רגילה', 96, '10-09-2026');
  add('09-08-2026', 'NETFLIX.COM', 'פנאי, בידור וספורט', 'רגילה', 54.9, '10-09-2026');
  add('12-08-2026', 'ארומה תל אביב', 'מסעדות', 'רגילה', 38, '10-09-2026');
  add('15-08-2026', 'פז תחנת דלק', 'דלק, חשמל וגז', 'רגילה', 310, '10-09-2026');
  add('20-08-2026', 'KSP מחשבים', 'חשמל ואלקטרוניקה', 'תשלומים', 250, '10-09-2026', 'תשלום 1 מתוך 12', 3000);
  add('28-08-2026', 'שופרסל אונליין', 'מזון וצריכה', 'רגילה', 520.4, '10-09-2026');
  // ספטמבר – כולל תשלום 2 וקפה כפול באותו יום
  add('02-09-2026', 'שופרסל דיל רמת גן', 'מזון וצריכה', 'רגילה', 389.9, '10-10-2026');
  add('03-09-2026', 'ארומה תל אביב', 'מסעדות', 'רגילה', 38, '10-10-2026');
  add('03-09-2026', 'ארומה תל אביב', 'מסעדות', 'רגילה', 38, '10-10-2026');
  add('09-09-2026', 'NETFLIX.COM', 'פנאי, בידור וספורט', 'רגילה', 54.9, '10-10-2026');
  add('14-09-2026', 'WOLT TEL AVIV', 'מסעדות', 'רגילה', 120, '10-10-2026');
  add('14-09-2026', 'WOLT TEL AVIV', 'מסעדות', 'רגילה', 88, '10-10-2026');
  add('20-08-2026', 'KSP מחשבים', 'חשמל ואלקטרוניקה', 'תשלומים', 250, '10-10-2026', 'תשלום 2 מתוך 12', 3000);
  add('18-09-2026', 'זארה', 'אופנה', 'רגילה', 299, '10-10-2026');
  add('22-09-2026', 'הפניקס ביטוח', 'ביטוח', 'הוראת קבע', 180, '10-10-2026');
  add('25-09-2026', 'סלקום', 'שירותי תקשורת', 'הוראת קבע', 129.9, '10-10-2026');
  add('29-09-2026', 'זיכוי ZARA', 'אופנה', 'זיכוי', 100, '10-10-2026');
  // אוקטובר – חלקי
  add('01-10-2026', 'שופרסל דיל רמת גן', 'מזון וצריכה', 'רגילה', 301.2, '10-11-2026');
  add('04-10-2026', 'NETFLIX.COM', 'פנאי, בידור וספורט', 'רגילה', 54.9, '10-11-2026');
  add('06-10-2026', 'פז תחנת דלק', 'דלק, חשמל וגז', 'רגילה', 280, '10-11-2026');
  add('20-08-2026', 'KSP מחשבים', 'חשמל ואלקטרוניקה', 'תשלומים', 250, '10-11-2026', 'תשלום 3 מתוך 12', 3000);
  const foreign: unknown[][] = [
    ['עסקאות חו"ל ומט"ח'], [], header,
    ['07-08-2026', 'AMAZON EU', 'קניות', '1234', 'רגילה', 188.55, '₪', 52.1, '$', '10-09-2026', ''],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'עסקאות במועד החיוב');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(foreign), 'עסקאות חו"ל ומט"ח');
  return toBytes(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function bankRows(): unknown[][] {
  const rows: unknown[][] = [
    ['תנועות בחשבון'], ['חשבון 123456'], [],
    ['תאריך', 'תאריך ערך', 'תיאור', 'אסמכתא', 'חובה', 'זכות', 'יתרה'],
  ];
  const add = (d: string, desc: string, debit: number | '', credit: number | '', ref = '1') =>
    rows.push([d, d, desc, ref, debit, credit, 5000]);
  for (const m of ['2026-08', '2026-09']) {
    const [y, mm] = m.split('-');
    add(`01/${mm}/${y}`, 'משכורת חברה בעמ', '', 14500);
    add(`03/${mm}/${y}`, 'שכר דירה - העברה', 4800, '');
    add(`10/${mm}/${y}`, 'מקס איט פיננסים', 3200, '');
    add(`15/${mm}/${y}`, 'עמלת פעולה בערוץ ישיר', 12.5, '');
    add(`20/${mm}/${y}`, 'הפקדה לפיקדון', 1000, '');
  }
  add('01/10/2026', 'משכורת חברה בעמ', '', 14500);
  add('03/10/2026', 'שכר דירה - העברה', 4800, '');
  add('05/10/2026', 'ביט העברה מדנה', '', 150);
  add('06/10/2026', 'משיכת מזומנים כספומט', 300, '');
  return rows;
}

function bankWorkbook(): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bankRows()), 'תנועות');
  return toBytes(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/** CSV בקידוד windows-1255 כמו שחלק מהבנקים מייצאים */
function bankCsvWin1255(): Uint8Array {
  const csv = bankRows().map((r) => r.join(',')).join('\r\n');
  const bytes: number[] = [];
  for (const ch of csv) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) bytes.push(c);
    else if (c >= 0x05d0 && c <= 0x05ea) bytes.push(0xe0 + (c - 0x05d0));
    else bytes.push(0x3f);
  }
  return new Uint8Array(bytes);
}

/* ---------- בדיקות ---------- */

function syntheticTests() {
  console.log('\n▸ ערכים: סכומים ותאריכים');
  check('סכום עם פסיק', parseAmount('1,234.50') === 1234.5);
  check('סכום בסוגריים', parseAmount('(120.00)') === -120);
  check('סכום עם ₪', parseAmount('₪ 89.90') === 89.9);
  check('סכום עם מינוס בסוף', parseAmount('55-') === -55);
  check('תאריך dd-mm-yyyy', parseDate('05-08-2026') === '2026-08-05');
  check('תאריך d/m/yy', parseDate('5/8/26') === '2026-08-05');
  check('תאריך סידורי של Excel', parseDate(46239) === '2026-08-05', parseDate(46239));
  check('תאריך לא חוקי', parseDate('31/02/2026') === null);

  console.log('\n▸ פירוק קובץ Max');
  const max = parseFile('max.xlsx', maxWorkbook());
  check('זוהה ככרטיס אשראי', max.kind === 'card');
  check('שני גיליונות', max.sheets === 2, max.sheets);
  check('מספר תנועות', max.transactions.length === 23, max.transactions.length);
  const inst = max.transactions.filter((t) => t.installment);
  check('3 תשלומים של KSP', inst.length === 3 && inst.every((t) => t.installment!.total === 12));
  check('תשלום משויך לפי תאריך חיוב', inst.map((t) => t.date).sort().join() === '2026-09-10,2026-10-10,2026-11-10', inst.map((t) => t.date));
  check('סכום עסקה מקורי נשמר', inst[0].installment!.originalAmount === 3000);
  const credit = max.transactions.find((t) => t.description.includes('זיכוי'))!;
  check('זיכוי הוא כסף נכנס', credit.amount === 100, credit.amount);
  check('הוצאה היא שלילית', max.transactions.find((t) => t.description === 'זארה')!.amount === -299);

  console.log('\n▸ פירוק בנק (xlsx ו-CSV בקידוד עברית ישן)');
  const bank = parseFile('bank.xlsx', bankWorkbook());
  check('זוהה כבנק', bank.kind === 'bank');
  check('חובה/זכות → סימן', bank.transactions.find((t) => t.description.startsWith('משכורת'))!.amount === 14500
    && bank.transactions.find((t) => t.description.startsWith('שכר דירה'))!.amount === -4800);
  const csv = parseFile('bank.csv', bankCsvWin1255());
  check('CSV win-1255 נקרא', csv.transactions.length === bank.transactions.length && csv.transactions[0].description.length > 0,
    csv.transactions[0]);

  console.log('\n▸ ייבוא, סיווג ומניעת כפילויות');
  const s = DEFAULT_SETTINGS;
  const r1 = mergeTransactions([], max.transactions, s);
  const r2 = mergeTransactions(r1.merged, bank.transactions, s);
  let all = r2.merged;
  check('הכול נוסף בפעם הראשונה', r1.added === 23 && r1.duplicates === 0 && r2.added === bank.transactions.length);
  const again = mergeTransactions(all, [...max.transactions, ...bank.transactions], s);
  check('ייבוא חוזר לא מוסיף כלום', again.added === 0 && again.duplicates === 23 + bank.transactions.length, again);
  const twoCoffee = all.filter((t) => t.description === 'ארומה תל אביב' && t.date === '2026-09-03');
  check('שני קפה זהים באותו יום נשמרים (לא כפילות)', twoCoffee.length === 2);
  const catOf = (desc: string, src?: string) => all.find((t) => t.description.includes(desc) && (!src || t.source === src))!.category;
  check('סיווג: שופרסל → סופר', catOf('שופרסל דיל') === 'groceries');
  check('סיווג: WOLT → משלוחים', catOf('WOLT') === 'delivery');
  check('סיווג: NETFLIX → מנויים', catOf('NETFLIX') === 'subscriptions');
  check('סיווג: סלקום → תקשורת', catOf('סלקום') === 'telecom');
  check('סיווג: פז → רכב', catOf('פז') === 'car');
  check('סיווג: KSP → קניות', catOf('KSP') === 'shopping');
  check('סיווג: משכורת בנק', catOf('משכורת') === 'salary');
  check('סיווג: מקס איט בבנק = חיוב אשראי (מוחרג)', catOf('מקס איט') === 'cc_payment');
  check('סיווג: פיקדון = חיסכון (מוחרג)', catOf('פיקדון') === 'savings');
  check('סיווג: עמלה', catOf('עמלת') === 'fees');
  check('סיווג: ביט נכנס = הכנסה אחרת', catOf('ביט') === 'income_other');
  check('סיווג: מזומן', catOf('משיכת מזומנים') === 'cash');
  check('סיווג: AMAZON מקובץ חו"ל', catOf('AMAZON') === 'shopping');
  // כלל משתמש
  const learned = mergeTransactions([], max.transactions.slice(0, 3), { ...s, merchantRules: { 'שופרסל דיל רמת גן': 'other' } });
  check('כלל משתמש גובר על כללים מובנים', learned.merged.find((t) => t.description.includes('שופרסל'))!.category === 'other');

  console.log('\n▸ חודשים חלקיים וסיכומים');
  const sum = buildSummaries(all, TODAY);
  const keys = sum.months.map((m) => m.key).join();
  check('חודשים רצופים אוג׳–אוק׳', keys === '2026-08,2026-09,2026-10', keys);
  const oct = sum.months.find((m) => m.key === '2026-10')!;
  const sep = sum.months.find((m) => m.key === '2026-09')!;
  check('אוקטובר חלקי ומסומן כחודש נוכחי', oct.partial && oct.ongoing);
  check('ספטמבר שלם', !sep.partial, sep);
  check('נובמבר (חיוב עתידי) לא נכנס להיסטוריה', !sum.months.some((m) => m.key === '2026-11'));
  check('חיוב כרטיס לא נספר כהוצאה', !('cc_payment' in sep.byCategory) && sep.income === 14500, sep);
  check('זיכוי מקטין הוצאה בקטגוריה', Math.round(sep.byCategory.clothing) === 199, sep.byCategory.clothing);
  check('חודש ברירת מחדל = אוקטובר', defaultMonth(sum) === '2026-10');
  const ov = monthOverview(oct, sum.months, 0, TODAY);
  check('כמה נשאר: הכנסה פחות הוצאה', Math.abs(ov.remaining - (oct.income - oct.expense)) < 0.01 && ov.daysLeft === 23, ov);
  const ovExpected = monthOverview(oct, sum.months, 15000, TODAY);
  check('הכנסה צפויה גבוהה מהממשית נכנסת לחישוב', ovExpected.incomeBasis === 15000 && ovExpected.incomeEstimated);
  check('תחזית לסוף חודש קיימת', ov.projectedExpense !== null && ov.projectedExpense > oct.expense);
  check('פילוח קטגוריות מסתכם ל-100%', Math.abs(categoryBreakdown(sep).reduce((a, c) => a + c.pct, 0) - 100) < 0.01);
  const tm = topMerchants(all, '2026-09', 20);
  check('בתי עסק: שכר דירה ראשון, ווֹלט מצטבר ל-208', tm[0].name.includes('שכר דירה') && tm.find((m) => m.name.includes('WOLT'))?.total === 208, tm.slice(0, 3));

  console.log('\n▸ תשלומים עתידיים');
  const com = installmentCommitments(all, TODAY);
  check('10 חודשי תשלום עתידיים (נובמבר כבר בקובץ + 4–12)', com.byMonth[0].month === '2026-11' && com.byMonth.length === 10, com.byMonth);
  check('סכום נותר = 10 × 250', com.totalRemaining === 2500, com.totalRemaining);

  console.log('\n▸ חיסכון');
  const rep = buildSavings(all, sum.months, oct);
  check('בסיס מחודשים שלמים', rep.basedOnMonths === 2 && !rep.estimated, rep.basedOnMonths);
  check('יש הזדמנויות ופוטנציאל', rep.opportunities.length > 0 && rep.potentialMonthly > 0 && Math.abs(rep.potentialYearly - rep.potentialMonthly * 12) < 0.01);
  check('מנוי נטפליקס זוהה', rep.recurring.some((r) => r.name.includes('NETFLIX')), rep.recurring.map((r) => r.name));
  check('סלקום זוהה כחוזר', rep.recurring.some((r) => r.name.includes('סלקום')));
  check('שכר דירה/סופר לא מוצגים כמנויים', !rep.recurring.some((r) => r.categoryId === 'groceries'));
  const onlyPartial = buildSummaries(all.filter((t) => t.date >= '2026-10-01'), TODAY);
  const repPartial = buildSavings(all.filter((t) => t.date >= '2026-10-01'), onlyPartial.months, onlyPartial.months[0]);
  check('רק חודש חלקי → הערכה מנורמלת', repPartial.estimated);
  console.log('   פוטנציאל חודשי:', Math.round(rep.potentialMonthly), '| שנתי:', Math.round(rep.potentialYearly));

  console.log('\n▸ גיבוי ושחזור');
  const backup = createBackup(all, { ...s, expectedIncome: 15000 }, '1.0.0');
  const text = JSON.stringify(backup);
  const parsed = parseBackup(text);
  check('גיבוי→שחזור שומר את כל התנועות וההגדרות', parsed.transactions.length === all.length && parsed.settings.expectedIncome === 15000 && parsed.dropped === 0);
  let threw = false;
  try { parseBackup('{"x":1}'); } catch { threw = true; }
  check('קובץ זר נדחה עם הודעה', threw);
  const merged = mergeBackup(all.slice(0, 10), s, parsed);
  check('מיזוג גיבוי מוסיף רק חסרים', merged.transactions.length === all.length && merged.added === all.length - 10);

  console.log('\n▸ קטגוריות');
  const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'), 'utf8'));
  const missing = CATEGORIES.filter((c) => !(c.icon in glyphs)).map((c) => c.icon);
  check('כל אייקוני הקטגוריות קיימים', missing.length === 0, missing);
  check('ברירת מחדל לקטגוריה לא מוכרת', getCategory('nope').id === 'other');
  void addMonths;
}

function realFiles(files: string[]) {
  console.log('\n▸ קבצים אמיתיים');
  const all: Transaction[] = [];
  let cur: Transaction[] = [];
  for (const f of files) {
    try {
      const parsed = parseFile(path.basename(f), toBytes(fs.readFileSync(f)));
      const res = mergeTransactions(cur, parsed.transactions, DEFAULT_SETTINGS);
      cur = res.merged;
      console.log(`  ${path.basename(f)}: ${parsed.kind === 'card' ? 'כרטיס אשראי' : 'בנק'}, ${parsed.transactions.length} תנועות, ${res.duplicates} כפילויות, ${parsed.skippedRows} שורות שדולגו`);
    } catch (e) {
      failures++;
      console.log(`  ✗ ${path.basename(f)}: ${(e as Error).message}`);
    }
  }
  all.push(...cur);
  const sum = buildSummaries(all, new Date().toISOString().slice(0, 10));
  for (const m of sum.months) {
    console.log(`  ${m.key}: הכנסות ${Math.round(m.income)} | הוצאות ${Math.round(m.expense)} | ${m.count} תנועות${m.partial ? ' | חלקי' : ''}`);
  }
  const uncategorized = all.filter((t) => t.category === 'other' && t.amount < 0);
  console.log(`  לא מסווגות (אחר): ${uncategorized.length}/${all.length}`);
  for (const t of uncategorized.slice(0, 15)) console.log(`    - ${t.description} (${t.amount})`);
}

const args = process.argv.slice(2);
const samplesDir = path.join(__dirname, '../samples');
const files = args.length ? args : fs.existsSync(samplesDir)
  ? fs.readdirSync(samplesDir).filter((f) => /\.(xlsx|xls|csv|html?)$/i.test(f)).map((f) => path.join(samplesDir, f))
  : [];
if (files.length) realFiles(files);
if (!args.length) syntheticTests();
console.log(failures ? `\n✗ ${failures} בדיקות נכשלו` : '\n✓ כל הבדיקות עברו');
process.exit(failures ? 1 : 0);
