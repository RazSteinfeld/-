/* ליבת החישוב: שכר למשמרת, חגים ושבתות, וברוטו → נטו.
   רץ גם בדפדפן (window.Core) וגם ב-Node (לבדיקות). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    rate: 44,                // שכר בסיס לשעה (₪)
    premiumPct: 150,         // אחוז שכר בשבת/חג
    premiumStart: '16:00',   // שישי / ערב חג – תחילת התעריף המוגדל
    premiumEnd: '04:00',     // ראשון / מוצאי חג – סיום התעריף המוגדל
    creditPoints: 2.25,      // נקודות זיכוי (2.25 = תושב ישראל גבר, 2.75 = אישה)
    pensionPct: 6,           // הפרשת עובד לפנסיה (%)
    courseHours: 10,         // אורך יום קורס (שעות), בתעריף רגיל
    courseStart: '08:00',    // שעת התחלה של יום קורס
    disabledHolidays: [],    // חגים שזוהו אוטומטית ומבוטלים ידנית (YYYY-MM-DD)
    extraHolidays: [],       // ימי חג שנוספו ידנית (YYYY-MM-DD)
  };

  // נתוני מס 2026 (חודשי). ניתן לעדכן כאן בתחילת שנה.
  const TAX = {
    brackets: [
      [7010, 0.10], [10060, 0.14], [16150, 0.20], [22440, 0.31],
      [46690, 0.35], [60130, 0.47], [Infinity, 0.50],
    ],
    creditPointValue: 242,
    pensionCreditRate: 0.35,   // זיכוי מס על הפרשת עובד לפנסיה
    niThreshold: 7703,         // סף מדרגה מופחתת בביטוח לאומי ובריאות
    niLow: 0.0104, niHigh: 0.07,
    healthLow: 0.0323, healthHigh: 0.0517,
  };

  // חגי ישראל לפי התאריך העברי (יום אחד, ללא חול המועד)
  const HOLIDAYS = [
    { m: 'tishri', d: 1, name: 'ראש השנה' },
    { m: 'tishri', d: 2, name: 'ראש השנה' },
    { m: 'tishri', d: 10, name: 'יום כיפור' },
    { m: 'tishri', d: 15, name: 'סוכות' },
    { m: 'tishri', d: 22, name: 'שמיני עצרת' },
    { m: 'nisan', d: 15, name: 'פסח' },
    { m: 'nisan', d: 21, name: 'שביעי של פסח' },
    { m: 'sivan', d: 6, name: 'שבועות' },
  ];

  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const hm = (s) => { const [h, m] = s.split(':').map(Number); return [h, m || 0]; };

  /* ---------- חגים ---------- */
  const hebFmt = new Intl.DateTimeFormat('en-u-ca-hebrew-nu-latn', { day: 'numeric', month: 'long' });
  const holidayCache = new Map();

  function baseHolidays(year) {
    if (holidayCache.has(year)) return holidayCache.get(year);
    const map = new Map();
    for (let i = 0; i < 366; i++) {
      const d = new Date(year, 0, 1 + i, 12);
      if (d.getFullYear() !== year) break;
      const parts = hebFmt.formatToParts(d);
      const day = Number(parts.find((p) => p.type === 'day').value);
      const month = parts.find((p) => p.type === 'month').value.toLowerCase();
      const h = HOLIDAYS.find((x) => month.startsWith(x.m) && x.d === day);
      if (h) map.set(dateKey(d), h.name);
    }
    holidayCache.set(year, map);
    return map;
  }

  /** רשימת חגים לשנה אזרחית: [{key, name, custom, disabled}] */
  function holidayList(year, settings) {
    const out = [];
    for (const [key, name] of baseHolidays(year)) {
      out.push({ key, name, custom: false, disabled: settings.disabledHolidays.includes(key) });
    }
    for (const key of settings.extraHolidays) {
      if (key.startsWith(year + '-')) out.push({ key, name: 'יום חג', custom: true, disabled: false });
    }
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }

  function holidayName(d, settings) {
    const key = dateKey(d);
    if (settings.extraHolidays.includes(key)) return 'יום חג';
    if (settings.disabledHolidays.includes(key)) return null;
    return baseHolidays(d.getFullYear()).get(key) || null;
  }

  /* ---------- חלונות שכר מוגדל ---------- */
  function premiumWindows(startMs, endMs, settings) {
    const [sh, sm] = hm(settings.premiumStart);
    const [eh, em] = hm(settings.premiumEnd);
    const first = new Date(startMs), last = new Date(endMs);
    const wins = [];
    const from = new Date(first.getFullYear(), first.getMonth(), first.getDate() - 3);
    const to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 3);
    for (let d = from; d <= to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const y = d.getFullYear(), mo = d.getMonth(), da = d.getDate();
      if (d.getDay() === 5) {
        wins.push({ s: new Date(y, mo, da, sh, sm).getTime(), e: new Date(y, mo, da + 2, eh, em).getTime(), kind: 'shabbat', name: 'שבת' });
      }
      const hn = holidayName(d, settings);
      if (hn) {
        wins.push({ s: new Date(y, mo, da - 1, sh, sm).getTime(), e: new Date(y, mo, da + 1, eh, em).getTime(), kind: 'holiday', name: hn });
      }
    }
    return wins;
  }

  function mergeWindows(wins) {
    const sorted = wins.map((w) => [w.s, w.e]).sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const w of sorted) {
      if (out.length && w[0] <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], w[1]);
      else out.push([...w]);
    }
    return out;
  }

  const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

  /* ---------- משמרת בודדת ---------- */
  /** shift: {start, end|null, mode?: 'auto'|'regular'|'premium'} (ms) */
  function computeShift(shift, settings, now = Date.now()) {
    const end = shift.end == null ? now : shift.end;
    const totalMs = Math.max(0, end - shift.start);
    const wins = premiumWindows(shift.start, end, settings);
    let premMs;
    if (shift.mode === 'regular') premMs = 0;
    else if (shift.mode === 'premium') premMs = totalMs;
    else premMs = mergeWindows(wins).reduce((s, w) => s + overlap(shift.start, end, w[0], w[1]), 0);
    const regMs = totalMs - premMs;
    const rate = settings.rate, mult = settings.premiumPct / 100;
    const pay = (regMs * rate + premMs * rate * mult) / 3600000;
    const labels = [];
    if (shift.mode === 'premium') labels.push('מוגדר ידנית');
    else if (shift.mode !== 'regular') {
      const hit = wins.filter((w) => overlap(shift.start, end, w.s, w.e) > 0);
      const names = [...new Set(hit.filter((w) => w.kind === 'holiday').map((w) => w.name))];
      if (names.length) labels.push(...names);
      else if (hit.length) labels.push('שבת');
    }
    return {
      open: shift.end == null, totalMs, premMs, regMs, pay,
      minutes: totalMs / 60000, premiumMinutes: premMs / 60000, regularMinutes: regMs / 60000,
      labels,
    };
  }

  /** יום קורס: משך קבוע בתעריף רגיל (ללא תוספת שבת/חג). day = Date של היום */
  function courseShift(day, settings) {
    const [h, m] = hm(settings.courseStart);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
    return { start, end: start + settings.courseHours * 3600000, mode: 'regular', type: 'course' };
  }

  /* ---------- ברוטו → נטו ---------- */
  function netFromGross(gross, settings) {
    const g = Math.max(0, gross);
    const T = TAX.niThreshold;
    const low = Math.min(g, T), high = Math.max(0, g - T);
    const ni = low * TAX.niLow + high * TAX.niHigh;
    const health = low * TAX.healthLow + high * TAX.healthHigh;
    const pension = g * (settings.pensionPct / 100);

    let taxRaw = 0, prev = 0;
    for (const [cap, rate] of TAX.brackets) {
      if (g > prev) taxRaw += (Math.min(g, cap) - prev) * rate;
      prev = cap;
    }
    const credits = settings.creditPoints * TAX.creditPointValue + pension * TAX.pensionCreditRate;
    const incomeTax = Math.max(0, taxRaw - credits);
    const net = g - incomeTax - ni - health - pension;
    return { gross: g, incomeTax, ni, health, pension, net };
  }

  /* ---------- סיכום חודשי ---------- */
  function monthSummary(shifts, year, month, settings, now = Date.now()) {
    const rows = shifts
      .filter((s) => { const d = new Date(s.start); return d.getFullYear() === year && d.getMonth() === month; })
      .sort((a, b) => b.start - a.start)
      .map((s) => ({ shift: s, calc: computeShift(s, settings, now) }));
    const sum = (f) => rows.reduce((t, r) => t + f(r.calc), 0);
    const gross = sum((c) => c.pay);
    return {
      rows, count: rows.length,
      minutes: sum((c) => c.minutes),
      premiumMinutes: sum((c) => c.premiumMinutes),
      regularMinutes: sum((c) => c.regularMinutes),
      ...netFromGross(gross, settings),
    };
  }

  return {
    DEFAULT_SETTINGS, TAX, HOLIDAYS,
    dateKey, parseKey, holidayList, holidayName, premiumWindows, mergeWindows,
    computeShift, courseShift, netFromGross, monthSummary,
  };
});
