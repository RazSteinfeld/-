'use strict';
process.env.TZ = 'Asia/Jerusalem';
const test = require('node:test');
const assert = require('node:assert');
const C = require('../core.js');

const S = () => JSON.parse(JSON.stringify(C.DEFAULT_SETTINGS));
const at = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const close = (a, b, eps = 0.005) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('יום חול רגיל: 8 שעות × 44', () => {
  // יום שלישי 6.10.2026
  const c = C.computeShift({ start: at(2026, 10, 6, 8), end: at(2026, 10, 6, 16) }, S());
  close(c.pay, 352);
  assert.equal(c.premiumMinutes, 0);
  assert.deepEqual(c.labels, []);
});

test('שישי 14:00–18:00: שעתיים רגיל + שעתיים 150%', () => {
  // שישי 9.10.2026
  const c = C.computeShift({ start: at(2026, 10, 9, 14), end: at(2026, 10, 9, 18) }, S());
  close(c.pay, 2 * 44 + 2 * 66);
  assert.equal(c.premiumMinutes, 120);
  assert.deepEqual(c.labels, ['שבת']);
});

test('מוצ"ש עד ראשון 04:00 עדיין 150%', () => {
  // שבת 10.10.2026 22:00 → ראשון 06:00: 6 שעות מוגדל + 2 רגיל
  const c = C.computeShift({ start: at(2026, 10, 10, 22), end: at(2026, 10, 11, 6) }, S());
  close(c.pay, 6 * 66 + 2 * 44);
  assert.equal(c.premiumMinutes, 360);
});

test('ראשון אחרי 04:00 – רגיל', () => {
  const c = C.computeShift({ start: at(2026, 10, 11, 4), end: at(2026, 10, 11, 12) }, S());
  close(c.pay, 8 * 44);
});

test('שבת מלאה 24 שעות', () => {
  const c = C.computeShift({ start: at(2026, 10, 10, 0), end: at(2026, 10, 10, 8) }, S());
  close(c.pay, 8 * 66);
});

test('משמרות קבועות: בוקר, ערב ולילה', () => {
  const S0 = S();
  // יום ג' 6.10: בוקר 6–14, ערב 14–22, לילה 22–06 – הכל רגיל
  close(C.computeShift({ start: at(2026, 10, 6, 6), end: at(2026, 10, 6, 14) }, S0).pay, 8 * 44);
  close(C.computeShift({ start: at(2026, 10, 6, 14), end: at(2026, 10, 6, 22) }, S0).pay, 8 * 44);
  close(C.computeShift({ start: at(2026, 10, 6, 22), end: at(2026, 10, 7, 6) }, S0).pay, 8 * 44);
  // שישי 9.10: בוקר רגיל, ערב – שעתיים רגיל + 6 ב-150%, לילה – הכל 150%
  close(C.computeShift({ start: at(2026, 10, 9, 6), end: at(2026, 10, 9, 14) }, S0).pay, 8 * 44);
  close(C.computeShift({ start: at(2026, 10, 9, 14), end: at(2026, 10, 9, 22) }, S0).pay, 2 * 44 + 6 * 66);
  close(C.computeShift({ start: at(2026, 10, 9, 22), end: at(2026, 10, 10, 6) }, S0).pay, 8 * 66);
  // שבת: לילה מ-22:00 עד 06:00 ראשון – 6 שעות 150% (עד 04:00) ושעתיים רגיל
  close(C.computeShift({ start: at(2026, 10, 10, 22), end: at(2026, 10, 11, 6) }, S0).pay, 6 * 66 + 2 * 44);
  // חמישי בלילה לשישי בבוקר – הכל רגיל
  close(C.computeShift({ start: at(2026, 10, 8, 22), end: at(2026, 10, 9, 6) }, S0).pay, 8 * 44);
});

test('חגי תשפ"ז מזוהים נכון', () => {
  const keys = C.holidayList(2026, S()).map((h) => h.key);
  for (const k of ['2026-09-12', '2026-09-13', '2026-09-21', '2026-09-26', '2026-10-03']) {
    assert.ok(keys.includes(k), 'חסר ' + k);
  }
  const pesach = C.holidayList(2026, S()).filter((h) => h.name === 'פסח').map((h) => h.key);
  assert.deepEqual(pesach, ['2026-04-02']);
});

test('ערב חג (יום חול) מ-16:00 הוא 150%', () => {
  // יום כיפור 21.9.2026 (שני) → ערב יום כיפור ראשון 20.9 16:00
  const c = C.computeShift({ start: at(2026, 9, 20, 14), end: at(2026, 9, 20, 18) }, S());
  close(c.pay, 2 * 44 + 2 * 66);
  assert.deepEqual(c.labels, ['יום כיפור']);
});

test('חג שבוטל ידנית לא נחשב', () => {
  const s = S(); s.disabledHolidays = ['2026-09-21'];
  const c = C.computeShift({ start: at(2026, 9, 21, 8), end: at(2026, 9, 21, 16) }, s);
  close(c.pay, 8 * 44);
});

test('חג שנוסף ידנית נחשב', () => {
  const s = S(); s.extraHolidays = ['2026-10-14'];
  const c = C.computeShift({ start: at(2026, 10, 14, 8), end: at(2026, 10, 14, 16) }, s);
  close(c.pay, 8 * 66);
});

test('דריסה ידנית של התעריף', () => {
  const base = { start: at(2026, 10, 6, 8), end: at(2026, 10, 6, 16) };
  close(C.computeShift({ ...base, mode: 'premium' }, S()).pay, 8 * 66);
  const fri = { start: at(2026, 10, 9, 14), end: at(2026, 10, 9, 18), mode: 'regular' };
  close(C.computeShift(fri, S()).pay, 4 * 44);
});

test('משמרת פתוחה מחושבת עד עכשיו', () => {
  const c = C.computeShift({ start: at(2026, 10, 6, 8), end: null }, S(), at(2026, 10, 6, 10, 30));
  assert.ok(c.open);
  close(c.pay, 2.5 * 44);
});

test('מעבר שעון קיץ לא שובר חישוב', () => {
  // 25.10.2026 – חזרה לשעון חורף (ראשון, 01:00-02:00 כפול)
  const c = C.computeShift({ start: at(2026, 10, 24, 20), end: at(2026, 10, 25, 8) }, S());
  assert.ok(c.pay > 0);
  assert.ok(c.premMs > 0);
});

test('נטו: שכר נמוך (מתחת לסף מס)', () => {
  // 5,000 ברוטו עם 2.25 נקודות: מס = 500 - 544.5 - זיכוי פנסיה → 0
  const n = C.netFromGross(5000, S());
  close(n.incomeTax, 0);
  close(n.ni, 5000 * 0.0104);
  close(n.health, 5000 * 0.0323);
  close(n.pension, 300);
  close(n.net, 5000 - n.ni - n.health - 300);
});

test('נטו: שכר 10,000', () => {
  const n = C.netFromGross(10000, S());
  // מס: 701 + 2990*0.14 = 1119.6 ; זיכוי: 544.5 + 600*0.35 = 754.5 → 365.1
  close(n.incomeTax, 365.1);
  // ב"ל: 7703*0.0104 + 2297*0.07 ; בריאות: 7703*0.0323 + 2297*0.0517
  close(n.ni, 7703 * 0.0104 + 2297 * 0.07);
  close(n.health, 7703 * 0.0323 + 2297 * 0.0517);
});

test('סיכום חודשי מסנן לפי חודש וממיין מהחדש לישן', () => {
  const shifts = [
    { id: 'a', start: at(2026, 10, 1, 8), end: at(2026, 10, 1, 16) },
    { id: 'b', start: at(2026, 10, 2, 8), end: at(2026, 10, 2, 12) },
    { id: 'c', start: at(2026, 9, 30, 8), end: at(2026, 9, 30, 16) },
  ];
  const m = C.monthSummary(shifts, 2026, 9, S());
  assert.equal(m.count, 2);
  assert.equal(m.rows[0].shift.id, 'b');
  close(m.gross, 12 * 44);
});
