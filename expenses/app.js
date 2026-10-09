/* הכנסות והוצאות – ממשק. כל הלוגיקה (פירוק קבצים, סיווג, סיכומים, חיסכון) נמצאת ב-core.js (window.Core).
   הנתונים נשמרים ב-localStorage של המכשיר בלבד; אין שום קריאת רשת. */
'use strict';
(function () {
  const C = window.Core;
  const KEY_TX = 'hv.transactions.v1';
  const KEY_SET = 'hv.settings.v1';
  const KEY_BACKUP = 'hv.lastBackup';
  const APP_VERSION = '1.0.0';

  /* ---------- עזרים ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${C.ICON_PATHS[name] || ''}"/></svg>`;
  const money = (n, o) => `<span class="num">${esc(C.fmtMoney(n, o))}</span>`;
  const pct = (n, sign) => `<span class="num">${esc(C.fmtPct(n, sign))}</span>`;
  const num = (n) => `<span class="num">${Math.round(n).toLocaleString('en-US')}</span>`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const badge = (id, size = 44) => {
    const c = C.getCategory(id);
    return `<span class="badge" style="--c:${c.color};--s:${size}px">${ico(c.icon)}</span>`;
  };
  const circleIcon = (name, color, size = 44) => `<span class="badge round" style="--c:${color};--s:${size}px">${ico(name)}</span>`;
  const pill = (label, tone = '', icon = '') => `<span class="pill ${tone}">${icon ? ico(icon) : ''}${label}</span>`;
  const empty = (icon, title, body, actions = '') =>
    `<div class="empty fx"><div class="art">${ico(icon)}</div><div class="col" style="gap:6px;align-items:center"><h2 class="h-title">${esc(title)}</h2><p class="ink2" style="margin:0">${esc(body)}</p></div>${actions}</div>`;
  const banner = (tone, text, act = '', actName = '') => {
    const icons = { info: 'information-outline', warn: 'alert-circle-outline', error: 'alert-octagon-outline', success: 'check-circle-outline' };
    return `<div class="banner ${tone === 'info' ? '' : tone}">${ico(icons[tone])}<div class="txt">${text}</div>${act ? `<button class="act" data-act="${actName}">${esc(act)}</button>` : ''}</div>`;
  };

  /* ---------- מצב ושמירה ---------- */
  let tx = [];
  let settings = { ...C.DEFAULT_SETTINGS };
  let loadError = false;
  let saveError = null;
  let persistEnabled = true;
  let dirty = false;
  let saveTimer = null;

  const S = {
    tab: 'overview',
    month: null,
    selCat: null,
    period: 'month',
    openOpp: null,
    f: { q: '', type: 'all', cat: null, src: null, scope: 'month' },
    notice: null,
  };

  function load() {
    try {
      const rawTx = localStorage.getItem(KEY_TX);
      const rawSet = localStorage.getItem(KEY_SET);
      const parsed = rawTx ? JSON.parse(rawTx) : [];
      if (!Array.isArray(parsed)) throw new Error('bad');
      tx = parsed;
      settings = { ...C.DEFAULT_SETTINGS, ...(rawSet ? JSON.parse(rawSet) : {}) };
      loadError = false;
    } catch {
      loadError = true;
      persistEnabled = false; // לא דורסים נתונים קיימים שלא הצלחנו לקרוא
    }
  }

  function flush() {
    clearTimeout(saveTimer);
    if (!persistEnabled || !dirty) return;
    try {
      localStorage.setItem(KEY_TX, JSON.stringify(tx));
      localStorage.setItem(KEY_SET, JSON.stringify(settings));
      dirty = false;
      if (saveError) { saveError = null; render(); }
    } catch {
      saveError = 'השמירה בטלפון נכשלה (ייתכן שנגמר המקום). מומלץ לייצא גיבוי עכשיו.';
      render();
    }
  }
  function touch() {
    dirty = true;
    derivedCache = null;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 300);
  }

  let derivedCache = null;
  let today = C.todayISO();
  function derived() {
    if (!derivedCache || derivedCache.today !== today) {
      const summaries = C.buildSummaries(tx, today);
      derivedCache = { today, summaries };
    }
    return derivedCache.summaries;
  }
  function currentMonth(sum) {
    if (S.month && sum.months.some((m) => m.key === S.month)) return S.month;
    return C.defaultMonth(sum);
  }

  /* ---------- הודעות ---------- */
  let toastTimer = null;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
  }

  /* ---------- גיליון תחתון ---------- */
  let sheetOpen = false;
  let sheetCtx = null;
  function openSheet(title, body, ctx) {
    sheetCtx = ctx || null;
    const html = `<div class="sheet-back"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title || 'חלון')}"><div class="grab"></div>${title ? `<div class="sh-title"><h2 class="h-title">${esc(title)}</h2></div>` : ''}<div class="sh-body">${body}</div></div></div>`;
    $('#sheet-root').innerHTML = html;
    if (!sheetOpen) history.pushState({ sheet: 1 }, '');
    sheetOpen = true;
  }
  function setSheetBody(body) {
    const b = $('#sheet-root .sh-body');
    if (b) b.innerHTML = body;
  }
  function closeSheet() {
    if (sheetOpen) history.back();
  }
  function removeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheetCtx = null;
    const back = $('#sheet-root .sheet-back');
    if (!back) return;
    back.classList.add('closing');
    $('.sheet', back)?.classList.add('closing');
    setTimeout(() => { if (!sheetOpen) $('#sheet-root').innerHTML = ''; }, 200);
  }
  window.addEventListener('popstate', removeSheet);

  /* ---------- ציור ---------- */
  function render(opts = {}) {
    const v = $('#view');
    v.classList.toggle('still', !!opts.still);
    if (loadError) { v.innerHTML = errorView(); renderTabs(); return; }
    const views = { overview: overviewView, transactions: transactionsView, savings: savingsView, more: moreView };
    v.innerHTML = views[S.tab]();
    renderTabs();
    afterRender();
  }

  function renderTabs() {
    const tabs = [
      ['overview', 'סקירה', 'chart-donut'], ['transactions', 'תנועות', 'swap-vertical'],
      ['savings', 'חיסכון', 'piggy-bank'], ['more', 'עוד', 'dots-grid'],
    ];
    $('#tabbar').innerHTML = `<div class="tabbar-inner" role="tablist">${tabs.map(([id, label, icon]) =>
      `<button class="tab ${S.tab === id ? 'on' : ''}" role="tab" aria-selected="${S.tab === id}" data-act="tab" data-tab="${id}">${ico(icon)}<span>${label}</span></button>`).join('')}</div>`;
    $('#tabbar').style.display = loadError ? 'none' : '';
  }

  function afterRender() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('[data-w]').forEach((el) => { el.style.width = el.dataset.w; });
      $$('.seg').forEach((el) => { el.style.strokeDasharray = el.dataset.dash; });
      $$('[data-count]').forEach(countUp);
    }));
  }

  const counters = new WeakMap();
  function countUp(el) {
    const target = Number(el.dataset.count);
    const from = counters.has(el) ? counters.get(el) : (el.dataset.from !== undefined ? Number(el.dataset.from) : 0);
    if ($('#view').classList.contains('still') || from === target) { el.innerHTML = money(target); counters.set(el, target); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 800);
      const e = 1 - Math.pow(1 - k, 3);
      el.innerHTML = money(from + (target - from) * e);
      if (k < 1) requestAnimationFrame(step); else counters.set(el, target);
    };
    requestAnimationFrame(step);
  }
  const countEl = (value, cls = '') => `<span class="${cls}" data-count="${value}">${money(0)}</span>`;

  /* ---------- שגיאת טעינה ---------- */
  function errorView() {
    return `<div class="empty"><div class="art">${ico('alert-octagon-outline')}</div>
      <h2 class="h-title">לא הצלחתי לקרוא את הנתונים השמורים</h2>
      <p class="ink2" style="margin:0">הנתונים עצמם לא נמחקו. אפשר לנסות שוב, להוריד עותק של מה ששמור, או להתחיל מאפס ולשחזר מגיבוי.</p>
      <button class="btn block" data-act="retry-load">${ico('plus')}נסה שוב</button>
      <button class="btn secondary block" data-act="raw-download">${ico('download')}הורדת העותק השמור</button>
      <button class="btn danger block" data-act="reset-load">התחל מאפס (מוחק את מה ששמור)</button></div>`;
  }

  /* ---------- סקירה ---------- */
  const heroStat = (icon, label, valueHtml) => `<div class="hero-stat"><div class="t">${ico(icon)}${label}</div><div class="v">${valueHtml}</div></div>`;

  function monthSwitcher(sum, key) {
    const idx = sum.months.findIndex((m) => m.key === key);
    if (idx < 0) return '';
    const cur = sum.months[idx];
    const hasPrev = idx > 0;
    const hasNext = idx < sum.months.length - 1;
    const sub = cur.ongoing ? '<div class="micro primary">החודש הנוכחי</div>' : cur.partial ? '<div class="micro warn">חודש חלקי</div>' : '';
    return `<div class="month-switch fx" style="--i:1">
      <button class="icon-btn" aria-label="חודש קודם" ${hasPrev ? '' : 'disabled'} data-act="month" data-m="${hasPrev ? sum.months[idx - 1].key : ''}">${ico('chevron-right')}</button>
      <div class="mid"><div class="h-head">${esc(C.monthLabel(cur.key))}</div>${sub}</div>
      <button class="icon-btn" aria-label="חודש הבא" ${hasNext ? '' : 'disabled'} data-act="month" data-m="${hasNext ? sum.months[idx + 1].key : ''}">${ico('chevron-left')}</button>
    </div>`;
  }

  function trendSvg(data, selKey, avgExpense) {
    const W = 360, H = 168, top = 8, base = H - 4, usable = base - top;
    const n = data.length;
    const slot = W / n;
    const barW = Math.max(6, Math.min(16, slot * 0.26));
    const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)), avgExpense || 0);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="גרף הכנסות והוצאות לפי חודש">`;
    for (const f of [0.25, 0.5, 0.75, 1]) s += `<line x1="0" x2="${W}" y1="${base - usable * f}" y2="${base - usable * f}" stroke="var(--line)" stroke-dasharray="3 5"/>`;
    if (avgExpense) {
      const y = base - (avgExpense / max) * usable;
      s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--primary)" stroke-width="1.5" stroke-dasharray="6 4" opacity=".7"/>`;
    }
    data.forEach((d, i) => {
      const cx = W - (i + 0.5) * slot;
      const hE = Math.max(d.expense > 0 ? 3 : 0, (Math.max(0, d.expense) / max) * usable);
      const hI = Math.max(d.income > 0 ? 3 : 0, (Math.max(0, d.income) / max) * usable);
      const op = !selKey || selKey === d.key ? 1 : 0.35;
      const delay = i * 60;
      s += `<g opacity="${op}">
        <rect class="bar" style="animation-delay:${delay}ms" x="${cx + 2}" y="${base - hI}" width="${barW}" height="${hI}" rx="${barW / 2.4}" fill="var(--pos)" opacity=".85"/>
        <rect class="bar" style="animation-delay:${delay}ms" x="${cx - 2 - barW}" y="${base - hE}" width="${barW}" height="${hE}" rx="${barW / 2.4}" fill="var(--primary)"/>
      </g>`;
      s += `<rect class="hit" data-act="month" data-m="${d.key}" x="${W - (i + 1) * slot}" y="0" width="${slot}" height="${H}"><title>${esc(C.monthLabel(d.key))}</title></rect>`;
    });
    return s + '</svg>';
  }

  function donutSvg(slices, selId) {
    const size = 224, thick = 24;
    const c = size / 2;
    const r = (size - thick) / 2 - 4;
    const L = 2 * Math.PI * r;
    const total = slices.reduce((a, s) => a + s.value, 0);
    const gap = slices.length > 1 ? Math.min(4, L * 0.01) : 0;
    let acc = 0;
    let s = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="התפלגות הוצאות לפי קטגוריה"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--alt)" stroke-width="${thick}"/>`;
    slices.forEach((sl, i) => {
      const len = (sl.value / total) * L;
      const dash = Math.max(1, len - gap);
      const start = acc;
      acc += len;
      const sel = selId === sl.id;
      const dim = selId && !sel;
      s += `<circle class="seg" data-act="cat-toggle" data-id="${sl.id}" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${sl.color}" stroke-width="${sel ? thick + 6 : thick}" stroke-opacity="${dim ? 0.3 : 1}" stroke-dashoffset="${-start}" style="stroke-dasharray:0 ${L};transition-delay:${i * 70}ms" data-dash="${dash} ${L - dash}"/>`;
    });
    return s + '</svg>';
  }

  function overviewView() {
    const sum = derived();
    const key = currentMonth(sum);
    const header = `<div class="screen-head fx"><div><h1 class="h-display">סקירה</h1><div class="cap">הכנסות והוצאות במבט אחד</div></div><button class="icon-btn primary" aria-label="ייבוא קבצים" data-act="import">${ico('file-upload-outline')}</button></div>`;
    const summary = sum.months.find((m) => m.key === key);
    if (!tx.length || !summary) {
      return header + empty('file-chart-outline', 'עוד אין כאן נתונים',
        'ייבא קובץ פירוט מ-Max או תנועות מהבנק, ותראה תוך שניות כמה נשאר לך החודש, לאן הולך הכסף ואיפה אפשר לחסוך. הכול נשאר בטלפון שלך.',
        `<button class="btn primary-shadow" data-act="import">${ico('file-upload-outline')}ייבוא קבצים</button><button class="btn ghost compact" data-act="restore">שחזור מגיבוי</button>`)
        + installCard();
    }
    const ov = C.monthOverview(summary, sum.months, settings.expectedIncome, today);
    const breakdown = C.categoryBreakdown(summary);
    const slices = breakdown.map((b) => ({ id: b.id, value: b.amount, color: C.getCategory(b.id).color }));
    const selected = S.selCat ? breakdown.find((b) => b.id === S.selCat) : null;
    const trendData = C.trend(sum.months, summary.key, 6).map((m) => ({ key: m.key, label: C.monthShort(m.key), income: m.income, expense: m.expense, partial: m.partial }));
    const avg = C.averages(sum.months);
    const merchants = C.topMerchants(tx, summary.key, 5);
    const commitments = C.installmentCommitments(tx, today);
    const stale = summary.ongoing ? C.staleDays(sum.range, today) : 0;
    const positive = ov.remaining >= 0;
    let i = 2;

    let h = header + monthSwitcher(sum, key);

    const lastBackup = Number(localStorage.getItem(KEY_BACKUP) || 0);
    const backupAge = lastBackup ? (Date.now() - lastBackup) / 86400000 : Infinity;
    if (saveError) h += banner('error', esc(saveError), 'גיבוי', 'backup');
    else if (backupAge > 30) h += banner('info', lastBackup ? 'עבר יותר מחודש מהגיבוי האחרון.' : 'עוד לא יצרת גיבוי. נתוני דפדפן יכולים להימחק, ולכן כדאי לגבות.', 'ייצוא גיבוי', 'backup');
    if (summary.partial) {
      const f = summary.firstDate ? C.formatDate(summary.firstDate) : '—';
      const l = summary.lastDate ? C.formatDate(summary.lastDate) : '—';
      h += banner('warn', summary.ongoing ? `החודש עוד לא נגמר, והנתונים מגיעים עד <span class="num">${l}</span>` : `בחודש הזה יש נתונים רק מ-<span class="num">${f}</span> עד <span class="num">${l}</span>, ולכן הסכומים חלקיים`);
    }
    if (stale > 6) h += banner('info', `התנועה האחרונה שיובאה היא מלפני ${stale} ימים. ייבא קובץ חדש כדי לעדכן.`, 'ייבוא', 'import');

    const heroLabel = summary.ongoing ? 'נשאר החודש' : positive ? 'נשאר בסוף החודש' : 'חריגה בחודש';
    const incomeLine = ov.incomeBasis > 0
      ? `מתוך הכנסה ${ov.incomeEstimated ? 'צפויה ' : ''}של ${money(ov.incomeBasis)}`
      : 'עוד לא נכנסה הכנסה החודש. אפשר להגדיר הכנסה צפויה בלשונית "עוד".';
    h += `<section class="hero ${positive ? '' : 'neg'} fx" style="--i:${i++}" aria-label="כמה נשאר החודש">
      <div><div class="lbl">${heroLabel}</div>${countEl(ov.remaining, 'big')}<div class="sub">${incomeLine}</div></div>
      <div class="col" style="gap:6px"><div class="progress" style="--h:10px"><i data-w="${Math.min(100, ov.spentRatio * 100)}%"></i></div>
        <div class="row between micro" style="color:rgba(255,255,255,.85)"><span>הוצא ${pct(ov.spentRatio * 100)}</span>${ov.daysLeft !== null ? `<span>${ov.daysLeft === 1 ? 'נשאר יום אחד' : `נשארו ${ov.daysLeft} ימים`}</span>` : ''}</div></div>
      <div class="hero-stats">${heroStat('arrow-down-circle-outline', 'הכנסות', money(summary.income))}${heroStat('arrow-up-circle-outline', 'הוצאות', money(summary.expense))}${ov.dailyAllowance !== null ? heroStat('calendar-today', 'ליום', money(ov.dailyAllowance)) : heroStat('swap-vertical', 'תנועות', `<span class="num">${summary.count}</span>`)}</div>
      ${ov.projectedExpense !== null ? `<div class="sub">בקצב הנוכחי תסיים את החודש עם הוצאות של כ-${money(ov.projectedExpense)}.</div>` : ''}
    </section>`;

    h += `<section class="card fx col" style="--i:${i++}"><div class="row between"><h2 class="h-title">מגמה חודשית</h2><div class="legend micro"><span><i style="background:var(--primary)"></i>הוצאות</span><span><i style="background:var(--pos)"></i>הכנסות</span></div></div>`;
    if (trendData.length > 1) {
      h += `<div class="chart-box">${trendSvg(trendData, summary.key, avg && !avg.scaled ? avg.expense : 0)}<div class="xlabels">${trendData.map((d) => `<div class="${d.key === summary.key ? 'on' : ''}"><span>${esc(d.label)}</span>${d.partial ? '<i></i>' : ''}</div>`).join('')}</div></div>`;
      if (avg) h += `<div class="row cap" style="gap:6px"><span style="width:14px;border-top:2px dashed var(--primary)"></span>ממוצע הוצאות חודשי: ${money(avg.expense)}${avg.scaled ? ' (הערכה)' : ''}</div>`;
    } else {
      h += '<p class="cap" style="margin:0">הגרף יתמלא כשיהיו נתונים ביותר מחודש אחד. ייבא קבצים נוספים כדי לראות מגמה.</p>';
    }
    h += '</section>';

    h += `<section class="card fx col" style="--i:${i++};gap:16px"><h2 class="h-title">לאן הולך הכסף</h2>`;
    if (breakdown.length) {
      const center = selected
        ? `${badge(selected.id, 36)}<div class="cap strong ellipsis" style="max-width:100%">${esc(C.getCategory(selected.id).label)}</div><div class="h-title">${money(selected.amount)}</div><div class="micro">${pct(selected.pct)} מההוצאות</div>`
        : `<div class="cap">סך הוצאות</div><div class="big">${money(summary.expense)}</div><div class="micro">${breakdown.length} קטגוריות</div>`;
      h += `<div class="donut-wrap">${donutSvg(slices, S.selCat)}<div class="donut-center">${center}</div></div><div class="col" style="gap:2px">`;
      for (const b of breakdown.slice(0, 8)) {
        const c = C.getCategory(b.id);
        h += `<button class="cat-row ${S.selCat === b.id ? 'on' : ''}" style="--c:${c.color}" data-act="cat-toggle" data-id="${b.id}">${badge(b.id, 38)}<div class="body"><div class="row between"><span class="strong ellipsis">${esc(c.label)}</span>${money(b.amount)}</div><div class="row" style="gap:8px"><div class="progress grow" style="--h:5px;--c:${c.color}"><i data-w="${b.pct}%"></i></div><span class="micro" style="min-width:34px;text-align:end">${pct(b.pct)}</span></div></div></button>`;
      }
      h += '</div>';
      if (selected) h += `<button class="btn ghost compact" style="align-self:center" data-act="go-tx" data-cat="${selected.id}" data-m="${summary.key}">הצג תנועות בקטגוריה ${ico('chevron-left')}</button>`;
    } else {
      h += '<p class="ink2" style="margin:0">אין הוצאות בחודש הזה.</p>';
    }
    h += '</section>';

    if (merchants.length) {
      h += `<section class="card fx col" style="--i:${i++};gap:4px"><h2 class="h-title" style="margin-bottom:4px">בתי העסק הגדולים</h2>`;
      merchants.forEach((m, k) => {
        h += `<div class="row" style="padding:8px 0"><span class="rank">${k + 1}</span>${badge(m.category, 38)}<div class="grow"><div class="strong ellipsis">${esc(m.name)}</div><div class="cap">${m.count === 1 ? 'תנועה אחת' : `${m.count} תנועות`}</div></div>${money(m.total, {})}</div>`;
      });
      h += '</section>';
    }

    if (commitments.byMonth.length) {
      const first = commitments.byMonth[0];
      const max = Math.max(...commitments.byMonth.slice(0, 6).map((c) => c.amount), 1);
      h += `<section class="card fx col" style="--i:${i++}"><div class="row between"><div><h2 class="h-title">תשלומים בדרך</h2><div class="cap">עוד ${money(commitments.totalRemaining)} ב-${commitments.series.length === 1 ? 'עסקת תשלומים אחת' : `${commitments.series.length} עסקאות תשלומים`}</div></div><span class="primary" style="font-size:26px">${ico('calendar-clock')}</span></div>
        <div class="minibars">${commitments.byMonth.slice(0, 6).map((c) => `<div><i style="height:${Math.max(4, (c.amount / max) * 56)}px"></i><span class="micro">${esc(C.monthShort(c.month))}</span></div>`).join('')}</div>
        <div class="cap">בחודש הקרוב (${esc(C.monthLabel(first.month, false))}) צפויים ${money(first.amount)} מתשלומים קיימים.</div></section>`;
    }
    return h;
  }

  /* ---------- תנועות ---------- */
  const SOURCE_LABEL = { card: 'כרטיס אשראי', bank: 'חשבון בנק', manual: 'ידני' };
  const SOURCE_ICON = { card: 'credit-card-outline', bank: 'bank-outline', manual: 'pencil-outline' };

  function filteredTx() {
    const f = S.f;
    const sum = derived();
    const month = currentMonth(sum);
    const q = f.q.trim().toLowerCase();
    const qNum = q && /^[\d.,]+$/.test(q) ? q.replace(/,/g, '') : null;
    return tx.filter((t) => {
      if (f.scope === 'month' && month && C.monthKey(t.date) !== month) return false;
      if (f.cat && t.category !== f.cat) return false;
      if (f.src && t.source !== f.src) return false;
      if (f.type === 'expense' && t.amount >= 0) return false;
      if (f.type === 'income' && t.amount <= 0) return false;
      if (q) {
        const hay = `${t.description} ${C.getCategory(t.category).label}`.toLowerCase();
        if (!hay.includes(q) && !(qNum && String(Math.abs(t.amount)).includes(qNum))) return false;
      }
      return true;
    });
  }

  function txRow(t) {
    const cat = C.getCategory(t.category);
    const excluded = C.flowOf(t).kind === 'none';
    const meta = [cat.label];
    if (t.installment) meta.push(`תשלום ${t.installment.index}/${t.installment.total}`);
    const positive = t.amount > 0;
    return `<button class="tx" data-act="tx" data-id="${esc(t.id)}" aria-label="${esc(t.description)}, ${esc(cat.label)}">${badge(t.category)}
      <div class="grow col" style="gap:2px"><div class="strong ellipsis">${esc(t.description)}</div><div class="meta">${ico(SOURCE_ICON[t.source])}<span class="cap ellipsis">${esc(meta.join(' · '))}</span></div></div>
      <div class="amt ${excluded ? 'muted' : positive ? 'pos' : ''}">${money(t.amount, { sign: positive })}${excluded ? '<div class="micro">לא נספר</div>' : ''}</div></button>`;
  }

  function txListHtml() {
    const list = filteredTx();
    if (!tx.length) {
      return empty('receipt-text-outline', 'אין עדיין תנועות', 'ייבא קובץ מ-Max או מהבנק כדי לראות כאן את כל התנועות, לחפש ולתקן סיווגים.', `<button class="btn" data-act="import">${ico('file-upload-outline')}ייבוא קבצים</button>`);
    }
    if (!list.length) {
      return empty('text-search-variant', 'לא נמצאו תנועות', 'נסה לשנות את החיפוש או את הסינון, או להציג את כל התקופה.', `<button class="btn" data-act="clear-filters">נקה סינון</button>`);
    }
    let income = 0, expense = 0;
    for (const t of list) {
      const fl = C.flowOf(t);
      if (fl.kind === 'income') income += fl.value; else if (fl.kind === 'expense') expense += fl.value;
    }
    let h = `<div class="card totals"><div><span class="micro">הוצאות</span><span class="h-head">${money(expense)}</span></div><div><span class="micro">הכנסות</span><span class="h-head pos">${money(income)}</span></div><div><span class="micro">נטו</span><span class="h-head">${money(income - expense, { sign: true })}</span></div></div>`;
    const groups = new Map();
    for (const t of list) { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date).push(t); }
    const MAX = 400;
    let shown = 0;
    for (const [date, items] of groups) {
      if (shown >= MAX) break;
      const slice = items.slice(0, MAX - shown);
      shown += slice.length;
      h += `<div class="day-head">${esc(C.dayHeading(date, today))}</div><div class="tx-group">${slice.map(txRow).join('')}</div>`;
    }
    if (shown < list.length) h += `<p class="cap" style="text-align:center">מוצגות ${shown} מתוך ${list.length} תנועות. צמצם את החיפוש או הסינון כדי לראות את השאר.</p>`;
    return h;
  }

  function filterChips() {
    const f = S.f;
    const active = (f.cat ? 1 : 0) + (f.src ? 1 : 0);
    const chip = (label, on, act, extra = '', icon = '', color = '') => `<button class="chip ${on ? 'on' : ''}" ${color ? `style="--c:${color}"` : ''} data-act="${act}" ${extra}>${icon ? ico(icon) : ''}${esc(label)}</button>`;
    let h = `<div class="row wrap" style="gap:8px">${chip('הכל', f.type === 'all', 'ftype', 'data-v="all"')}${chip('הוצאות', f.type === 'expense', 'ftype', 'data-v="expense"', 'arrow-up')}${chip('הכנסות', f.type === 'income', 'ftype', 'data-v="income"', 'arrow-down')}${chip(active ? `סינון (${active})` : 'סינון', active > 0, 'filter-open', '', 'tune-variant')}</div>`;
    h += `<div class="row wrap" style="gap:8px">${chip(f.scope === 'month' ? 'החודש הנבחר' : 'כל התקופה', false, 'fscope', '', f.scope === 'month' ? 'calendar-month-outline' : 'infinity')}`;
    if (f.cat) { const c = C.getCategory(f.cat); h += chip(c.label, true, 'fcat-clear', '', c.icon, c.color); }
    if (f.src) h += chip(SOURCE_LABEL[f.src], true, 'fsrc-clear');
    h += '</div>';
    return h;
  }

  function transactionsView() {
    const sum = derived();
    const month = currentMonth(sum);
    const sub = `${filteredTx().length} תנועות${S.f.scope === 'month' && month ? ` · ${C.monthLabel(month)}` : ' · כל התקופה'}`;
    return `<div class="screen-head fx"><div><h1 class="h-display">תנועות</h1><div class="cap" id="tx-sub">${esc(sub)}</div></div></div>
      <label class="search fx" style="--i:1">${ico('magnify')}<input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="חיפוש לפי שם בית עסק, קטגוריה או סכום" value="${esc(S.f.q)}" aria-label="חיפוש תנועות"></label>
      <div class="col fx" style="--i:2;gap:8px" id="tx-chips">${filterChips()}</div>
      <div id="tx-list" class="col" style="gap:0">${txListHtml()}</div>`;
  }

  function refreshTxList() {
    if (S.tab !== 'transactions') return;
    const l = $('#tx-list'); if (!l) return;
    l.innerHTML = txListHtml();
    $('#tx-chips').innerHTML = filterChips();
    const sum = derived();
    const month = currentMonth(sum);
    $('#tx-sub').textContent = `${filteredTx().length} תנועות${S.f.scope === 'month' && month ? ` · ${C.monthLabel(month)}` : ' · כל התקופה'}`;
  }

  function filterSheetBody() {
    const f = S.f;
    const chip = (label, on, act, data, icon, color) => `<button class="chip ${on ? 'on' : ''}" ${color ? `style="--c:${color}"` : ''} data-act="${act}" ${data}>${icon ? ico(icon) : ''}${esc(label)}</button>`;
    return `<div class="cap strong">מקור</div><div class="row wrap" style="gap:8px">${['card', 'bank', 'manual'].map((s) => chip(SOURCE_LABEL[s], f.src === s, 'fsrc', `data-v="${s}"`)).join('')}</div>
      <div class="cap strong">קטגוריה</div><div class="row wrap" style="gap:8px">${C.CATEGORIES.map((c) => chip(c.label, f.cat === c.id, 'fcat', `data-v="${c.id}"`, c.icon, c.color)).join('')}</div>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn secondary grow" data-act="filter-reset">נקה הכל</button><button class="btn grow" data-act="sheet-close">הצג ${filteredTx().length} תנועות</button></div>`;
  }

  function txSheetBody(t) {
    const key = C.normalizeMerchant(t.description);
    let others = 0;
    if (key) for (const o of tx) if (o.id !== t.id && C.normalizeMerchant(o.description) === key) others++;
    const groups = [['הוצאות', 'expense'], ['הכנסות', 'income'], ['לא נספר בחישובים', 'transfer']];
    if (t.amount > 0) groups.sort((a) => (a[1] === 'income' ? -1 : 0));
    const inst = t.installment
      ? `<div class="cap">תשלום ${t.installment.index} מתוך ${t.installment.total}${t.installment.originalAmount ? ` · סכום העסקה המלא ${money(t.installment.originalAmount)}` : ''}</div>` : '';
    return `<div class="row">${badge(t.category, 52)}<div class="grow"><div class="h-head">${esc(t.description)}</div><div class="cap">${C.formatDate(t.date)}${t.purchaseDate && t.purchaseDate !== t.date ? ` · נרכש ב-${C.formatDate(t.purchaseDate)}` : ''}</div></div><div class="h-title ${t.amount > 0 ? 'pos' : ''}">${money(t.amount, { sign: true })}</div></div>
      ${inst}${t.note ? `<div class="cap">${esc(t.note)}</div>` : ''}
      ${others > 0 ? `<label class="row between" style="background:var(--alt);border-radius:var(--r-md);padding:12px"><div class="grow"><div class="strong">החל על כל בית העסק</div><div class="cap">עוד ${others} תנועות של "${esc(key || t.description)}" ובייבואים הבאים</div></div><input type="checkbox" class="switch" id="apply-all" checked></label>` : ''}
      ${groups.map(([title, kind]) => `<div class="col" style="gap:8px"><div class="cap strong">${title}</div><div class="row wrap" style="gap:8px">${C.CATEGORIES.filter((c) => c.kind === kind).map((c) => `<button class="chip ${t.category === c.id ? 'on' : ''}" style="--c:${c.color}" data-act="set-cat" data-id="${esc(t.id)}" data-cat="${c.id}" data-others="${others}">${ico(c.icon)}${esc(c.label)}</button>`).join('')}</div></div>`).join('')}
      <div id="del-zone" style="text-align:center"><button class="btn ghost compact neg" style="color:var(--neg)" data-act="del-ask">${ico('trash-can-outline')}מחק תנועה</button></div>`;
  }

  /* ---------- חיסכון ---------- */
  function savingsView() {
    const sum = derived();
    const key = currentMonth(sum);
    const selected = sum.months.find((m) => m.key === key) || null;
    const head = `<div class="screen-head fx"><div><h1 class="h-display">חיסכון</h1><div class="cap">איפה אפשר לחסוך בלי להרגיש</div></div></div>`;
    if (!tx.length || !selected) {
      return head + empty('piggy-bank-outline', 'אין עדיין מה לנתח', 'אחרי שתייבא תנועות של חודש או שניים, אחשב כמה אפשר לחסוך, אראה השוואה לממוצע שלך ואזהה מנויים וחיובים קבועים.', `<button class="btn" data-act="import">${ico('file-upload-outline')}ייבוא קבצים</button>`);
    }
    const r = C.buildSavings(tx, sum.months, selected);
    const target = S.period === 'month' ? r.potentialMonthly : r.potentialYearly;
    let i = 1;
    let h = head + monthSwitcher(sum, key);
    h += `<section class="hero save fx" style="--i:${i++}"><div class="row between"><div class="grow"><div class="lbl">פוטנציאל חיסכון ${S.period === 'month' ? 'חודשי' : 'שנתי'}</div>${countEl(target, 'big')}</div><span class="badge round" style="--c:#fff;--s:60px;background:rgba(255,255,255,.2)">${ico('piggy-bank')}</span></div>
      <div class="row" style="gap:8px"><button class="toggle ${S.period === 'month' ? 'on' : ''}" data-act="period" data-v="month">חודשי</button><button class="toggle ${S.period === 'year' ? 'on' : ''}" data-act="period" data-v="year">שנתי</button></div>
      <div class="sub" style="color:rgba(255,255,255,.92)">${r.opportunities.length ? `אם תיישם את ההמלצות למטה, תחסוך כ-${money(r.potentialMonthly)} בחודש, כלומר כ-${money(r.potentialYearly)} בשנה.` : 'לא מצאתי כרגע הזדמנויות משמעותיות. ההוצאות שלך מאוזנות לפי הנתונים שיש.'}</div>
      <div class="micro" style="color:rgba(255,255,255,.75)">${r.estimated ? 'הערכה מבוססת על חודש חלקי בלבד, ותתחדד ככל שתייבא עוד חודשים.' : `מבוסס על ממוצע של ${r.basedOnMonths === 1 ? 'חודש אחד שלם' : `${r.basedOnMonths} חודשים שלמים`}. זו הערכה ולא הבטחה.`}</div></section>`;
    if (!(r.basedOnMonths > 0 || r.estimated)) h += banner('warn', 'עדיין אין מספיק נתונים לחישוב מדויק. ייבא לפחות שבוע שלם של תנועות.', 'ייבוא', 'import');

    if (r.savingsRate !== null) {
      const sr = r.savingsRate;
      const tone = sr >= 20 ? 'pos' : sr >= 0 ? 'warn' : 'neg';
      h += `<section class="card fx col" style="--i:${i++};gap:8px"><div class="row between"><h2 class="h-title">שיעור חיסכון</h2>${pill(sr >= 20 ? 'מצוין' : sr >= 10 ? 'סביר' : sr >= 0 ? 'אפשר יותר' : 'מעל ההכנסה', tone)}</div>
        <div class="h-display ${sr >= 0 ? 'pos' : 'neg'}">${pct(sr)}</div><div class="progress"><i style="background:${sr >= 0 ? 'var(--pos)' : 'var(--neg)'}" data-w="${Math.min(100, Math.max(0, sr) / 40 * 100)}%"></i></div>
        <div class="cap">מהכנסה חודשית ממוצעת של ${money(r.avg ? r.avg.income : 0)} נשארים בממוצע ${money((r.avg ? r.avg.income : 0) - r.baseMonthlyExpense)}. היעד המקובל הוא 15%–20%.</div></section>`;
    }

    if (r.opportunities.length) {
      h += `<h2 class="h-title fx" style="--i:${i++}">הזדמנויות לחיסכון</h2>`;
      for (const o of r.opportunities) {
        const c = C.getCategory(o.categoryId);
        const open = S.openOpp === o.id;
        const effTone = o.effort === 'קל' ? 'primary' : o.effort === 'בינוני' ? 'warn' : 'neg';
        h += `<section class="card fx opp" style="--i:${i++};--c:${c.color}"><button class="opp-head" data-act="opp" data-id="${o.id}" aria-expanded="${open}">${badge(o.categoryId, 48)}<div class="grow"><div class="h-head ellipsis">${esc(o.title)}</div><div class="cap">${o.insight}</div></div><span class="muted" style="font-size:24px">${ico(open ? 'chevron-up' : 'chevron-down')}</span></button>
          <div class="row wrap" style="gap:8px">${pill(`חיסכון אפשרי ${money(o.potentialMonthly)} בחודש`, 'pos', 'trending-down')}${pill(`${money(o.potentialMonthly * 12)} בשנה`)}${pill(o.effort, effTone, 'speedometer')}${o.aboveAverage ? pill('גבוה מהרגיל', 'neg', 'alert-outline') : ''}</div>
          ${open ? `<div class="steps"><div class="cap strong">צעדים מעשיים</div>${o.steps.map((s, k) => `<div class="step"><b>${k + 1}</b><span>${esc(s)}</span></div>`).join('')}<button class="btn ghost compact" style="align-self:flex-start;min-height:32px;padding:0" data-act="go-tx" data-cat="${o.categoryId}" data-m="">הצג את התנועות בקטגוריה</button></div>` : ''}</section>`;
      }
    }

    if (r.comparisons.length) {
      h += `<section class="card fx col" style="--i:${i++};gap:16px"><div><h2 class="h-title">${esc(C.monthLabel(selected.key))} מול הממוצע שלך</h2><div class="cap">${r.avg && r.avg.scaled ? 'הממוצע מבוסס על חודשים חלקיים (הערכה). ' : `ממוצע של ${r.avg ? r.avg.months : 0} חודשים שלמים. `}${r.proRatedDays ? `החודש חלקי, ולכן הממוצע מותאם ל-${r.proRatedDays} הימים שמכוסים.` : ''}</div></div>`;
      for (const c of r.comparisons) {
        const cat = C.getCategory(c.categoryId);
        const up = c.delta > 0;
        const max = Math.max(c.current, c.average, 1);
        h += `<div class="cmp" style="--c:${cat.color}"><div class="row between"><div class="row grow" style="gap:8px">${badge(c.categoryId, 32)}<span class="strong ellipsis">${esc(cat.label)}</span></div>${pill(`${up ? '▲' : '▼'} ${pct(Math.abs(c.deltaPct))} · ${money(Math.abs(c.delta))}`, up ? 'neg' : 'pos')}</div>
          <div class="line"><span class="lbl">החודש</span><div class="progress grow" style="--h:7px"><i data-w="${c.current / max * 100}%"></i></div><span class="val">${money(c.current)}</span></div>
          <div class="line"><span class="lbl">ממוצע</span><div class="progress grow" style="--h:7px"><i style="opacity:.4" data-w="${c.average / max * 100}%"></i></div><span class="val muted">${money(c.average)}</span></div></div>`;
      }
      h += '</section>';
    } else if (!r.avg) {
      h += banner('info', 'ההשוואה לממוצע תופיע כשיהיה לפחות חודש נוסף שלם בנתונים.');
    }

    h += `<section class="card fx col" style="--i:${i++}"><div class="row between"><div class="grow"><h2 class="h-title">מנויים וחיובים קבועים</h2><div class="cap">${r.recurring.length ? `${r.recurring.length} חיובים חוזרים · ${money(r.recurringMonthly)} בחודש · ${money(r.recurringMonthly * 12)} בשנה` : 'לא זוהו מנויים או חיובים חוזרים.'}</div></div><span class="primary" style="font-size:26px">${ico('autorenew')}</span></div>`;
    if (r.recurring.length) {
      h += `<div>${r.recurring.slice(0, 12).map((x) => `<div class="rec">${badge(x.categoryId, 40)}<div class="grow"><div class="strong ellipsis">${esc(x.name)}</div><div class="cap">${x.months} חודשים · ${money(x.monthly * 12)} בשנה</div></div><div class="col" style="gap:3px;align-items:flex-end">${money(x.monthly)}${x.isSubscription ? pill('מנוי', 'primary') : ''}</div></div>`).join('')}</div><div class="cap">טיפ: עבור על הרשימה ובטל כל מה שלא השתמשת בו בחודש האחרון.</div>`;
    } else {
      h += '<div class="cap">ככל שיצטברו כמה חודשים של נתונים, אזהה אוטומטית מנויים, הוראות קבע וחיובים חוזרים שכדאי לבדוק.</div>';
    }
    return h + '</section>';
  }

  /* ---------- עוד ---------- */
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (S.tab === 'more' || !tx.length) render({ still: true }); });
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function installCard() {
    if (isStandalone()) return '';
    return `<section class="card fx col" style="--i:3"><div class="row">${circleIcon('home-import-outline', 'var(--primary)', 44)}<div class="grow"><div class="strong">הוסף למסך הבית</div><div class="cap">כך האפליקציה נפתחת כמו אפליקציה רגילה, גם בלי אינטרנט.</div></div></div><button class="btn secondary" data-act="install">איך מוסיפים</button></section>`;
  }

  function setRow(icon, color, title, sub, act, extra = '', danger = false) {
    return `<button class="set-row ${danger ? 'danger' : ''}" data-act="${act}" ${extra}>${circleIcon(icon, danger ? 'var(--neg)' : color, 40)}<div class="grow"><div class="strong t">${esc(title)}</div><div class="cap">${sub}</div></div>${ico('chevron-left')}</button>`;
  }

  function moreView() {
    const sum = derived();
    const range = sum.range;
    const lastBackup = Number(localStorage.getItem(KEY_BACKUP) || 0);
    const canShare = !!(navigator.canShare && navigator.share);
    let h = `<div class="screen-head fx"><div><h1 class="h-display">עוד</h1><div class="cap">נתונים, גיבוי והגדרות</div></div></div>`;
    if (S.notice) h += banner(S.notice.tone, esc(S.notice.text));
    if (saveError) h += banner('error', esc(saveError));
    h += `<section class="card fx col" style="--i:1"><div class="row">${circleIcon('shield-lock-outline', 'var(--pos)', 48)}<div class="grow"><div class="h-head">הנתונים שלך נשארים אצלך</div><div class="cap">הכול נשמר רק בטלפון הזה, בדפדפן. אין שרת, אין חשבון, ואין אנליטיקס. האפליקציה לא שולחת שום מידע החוצה.</div></div></div><hr class="divider">
      <div class="row between"><div><div class="micro">תנועות שמורות</div><div class="h-head">${num(tx.length)}</div></div><div><div class="micro">טווח תאריכים</div><div class="strong">${range ? `<span class="num">${C.formatDate(range.min)}</span> – <span class="num">${C.formatDate(range.max)}</span>` : '—'}</div></div></div></section>`;
    h += `<section class="card flush fx" style="--i:2">${setRow('file-upload-outline', 'var(--primary)', 'ייבוא קבצים', 'Max, בנק מזרחי, Excel או CSV', 'import')}
      ${canShare ? setRow('content-save-outline', 'var(--pos)', 'ייצוא גיבוי', `שמירה או שיתוף של קובץ JSON עם כל הנתונים${lastBackup ? ` · גיבוי אחרון <span class="num">${C.formatDate(C.todayISO(new Date(lastBackup)))}</span>` : ' · עוד לא גובה'}`, 'backup') : ''}
      ${setRow('download', 'var(--pos)', canShare ? 'הורדת גיבוי לקובץ' : 'ייצוא גיבוי', `הורדת קובץ JSON עם כל הנתונים${!canShare ? (lastBackup ? ` · גיבוי אחרון <span class="num">${C.formatDate(C.todayISO(new Date(lastBackup)))}</span>` : ' · עוד לא גובה') : ''}`, 'backup-download')}
      ${setRow('backup-restore', 'var(--warn)', 'שחזור מגיבוי', 'טעינת נתונים מקובץ גיבוי (החלפת טלפון, ניקוי דפדפן)', 'restore')}</section>`;
    h += `<section class="card flush fx" style="--i:3">${setRow('cash-plus', 'var(--primary)', 'הכנסה חודשית צפויה', settings.expectedIncome > 0 ? `${money(settings.expectedIncome)} · משמש לחישוב "כמה נשאר"` : 'לא הוגדרה. מומלץ, כדי שהסקירה תעבוד גם לפני שהמשכורת נכנסה', 'income')}</section>`;
    if (!isStandalone()) h += `<section class="card flush fx" style="--i:4">${setRow('home-import-outline', 'var(--primary)', 'הוספה למסך הבית', 'כדי לפתוח את האפליקציה כמו אפליקציה רגילה', 'install')}</section>`;
    h += `<section class="card flush fx" style="--i:5">${setRow('trash-can-outline', '', 'מחיקת כל הנתונים', 'מוחק את כל התנועות וההגדרות מהטלפון', 'clear-ask', '', true)}</section>
      <div class="cap" style="text-align:center">הכנסות והוצאות · גרסה ${APP_VERSION}</div>`;
    return h;
  }

  /* ---------- ייבוא קבצים ---------- */
  function pickFiles(accept, multiple) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept;
      inp.multiple = !!multiple;
      inp.style.display = 'none';
      document.body.appendChild(inp);
      let done = false;
      const finish = (files) => { if (done) return; done = true; inp.remove(); resolve(files); };
      inp.addEventListener('change', () => finish([...inp.files]));
      inp.addEventListener('cancel', () => finish([]));
      inp.click();
    });
  }

  function importIdleBody(error) {
    return `<div class="card l2 col" style="align-items:center;text-align:center;gap:16px;padding:24px 16px">${circleIcon('file-excel-outline', 'var(--primary)', 84)}
      <div class="col" style="gap:6px"><h3 class="h-title">בחר קבצי Excel או CSV</h3><p class="ink2" style="margin:0">אפשר לבחור כמה קבצים יחד: פירוט כרטיס Max וקובץ תנועות מהבנק. אני מזהה את הסוג לבד, מסווג הוצאות ומדלג על תנועות שכבר יובאו.</p></div>
      <button class="btn block primary-shadow" data-act="import-pick">${ico('folder-open-outline')}בחירת קבצים</button><div class="micro">הקבצים נקראים בטלפון בלבד ולא נשלחים לשום מקום.</div></div>
      ${error ? banner('error', esc(error)) : ''}
      <details class="card"><summary class="h-head" style="cursor:pointer">איך מורידים את הקבצים?</summary><div class="col" style="margin-top:12px">
        <div class="row" style="align-items:flex-start">${circleIcon('credit-card-outline', 'var(--primary)', 40)}<div class="grow"><div class="strong">כרטיס אשראי (Max)</div><div class="cap">באתר או באפליקציית Max, בפירוט העסקאות, בחר טווח תאריכים ולחץ על ייצוא ל-Excel. שמור את הקובץ בטלפון.</div></div></div>
        <div class="row" style="align-items:flex-start">${circleIcon('bank-outline', 'var(--primary)', 40)}<div class="grow"><div class="strong">חשבון בנק (מזרחי-טפחות)</div><div class="cap">באתר הבנק, בתנועות בחשבון, בחר טווח תאריכים וייצא ל-Excel או ל-CSV.</div></div></div>
        <div class="row" style="align-items:flex-start">${circleIcon('calendar-sync-outline', 'var(--primary)', 40)}<div class="grow"><div class="strong">עדכון חודשי</div><div class="cap">כל חודש אפשר לייבא קובץ חדש. תנועות שכבר קיימות לא יוכפלו, גם אם הקבצים חופפים.</div></div></div></div></details>`;
  }

  async function runImport() {
    let files;
    try {
      files = await pickFiles('.xlsx,.xls,.csv,.html,.htm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/html', true);
    } catch {
      setSheetBody(importIdleBody('לא הצלחתי לפתוח את בורר הקבצים. נסה שוב.'));
      return;
    }
    if (!files.length) return;
    const items = files.map((f) => ({ name: f.name, status: 'pending', msg: '' }));
    const draw = (done, summary) => {
      const rows = items.map((it) => `<div class="row" style="padding:8px 0"><span style="width:28px;display:flex;justify-content:center">${it.status === 'pending' || it.status === 'parsing' ? '<span class="spin"></span>' : `<span class="${it.status === 'ok' ? 'pos' : 'neg'}" style="font-size:24px">${ico(it.status === 'ok' ? 'check-circle' : 'alert-circle')}</span>`}</span><div class="grow"><div class="strong ellipsis">${esc(it.name)}</div>${it.msg ? `<div class="cap ${it.status === 'error' ? 'neg' : ''}">${esc(it.msg)}</div>` : ''}</div></div>`).join('');
      let out = `<div class="card col" style="gap:4px"><h3 class="h-title">${done ? 'סיימנו' : 'קורא את הקבצים…'}</h3>${rows}</div>`;
      if (done && summary) {
        const failed = items.filter((i) => i.status === 'error').length;
        if (summary.added > 0) {
          out += `<div class="card l2 col" style="align-items:center;text-align:center;gap:12px">${circleIcon('check-bold', 'var(--pos)', 64)}<div class="h-display">נוספו ${num(summary.added)} תנועות</div>${summary.duplicates ? `<p class="ink2" style="margin:0">${num(summary.duplicates)} תנועות כבר היו קיימות, ודילגתי עליהן.</p>` : ''}${summary.skipped ? `<div class="cap">${summary.skipped} שורות בקבצים לא נקראו (חסר תאריך או סכום).</div>` : ''}<div class="cap">אפשר לתקן סיווג של כל תנועה בלשונית "תנועות".</div></div>`;
        } else {
          out += banner(failed === items.length ? 'error' : 'info', failed === items.length ? 'לא הצלחתי לקרוא אף קובץ. בדוק שהקבצים הם ייצוא Excel/CSV מ-Max או מהבנק.' : 'לא נוספו תנועות חדשות: כל מה שבקבצים כבר קיים באפליקציה.');
        }
        out += `${summary.added > 0 ? `<button class="btn block" data-act="import-done">${ico('chart-donut')}לסקירה</button>` : ''}<button class="btn secondary block" data-act="import-pick">${ico('plus')}ייבוא קבצים נוספים</button><button class="btn ghost block" data-act="sheet-close">סגירה</button>`;
      }
      setSheetBody(out);
    };
    draw(false);
    const parsed = [];
    for (let i = 0; i < files.length; i++) {
      items[i].status = 'parsing';
      draw(false);
      await sleep(60);
      try {
        const bytes = new Uint8Array(await files[i].arrayBuffer());
        const pf = C.parseFile(files[i].name, bytes);
        parsed.push(pf);
        items[i].status = 'ok';
        items[i].msg = `${pf.kind === 'bank' ? 'חשבון בנק' : 'כרטיס אשראי'} · ${pf.transactions.length} תנועות`;
      } catch (e) {
        items[i].status = 'error';
        items[i].msg = e instanceof C.FriendlyError ? e.message : 'לא הצלחתי לקרוא את הקובץ הזה.';
      }
    }
    const summary = { added: 0, duplicates: 0, skipped: 0 };
    let current = tx;
    for (const pf of parsed) {
      const res = C.mergeTransactions(current, pf.transactions, settings);
      current = res.merged;
      summary.added += res.added;
      summary.duplicates += res.duplicates;
      summary.skipped += pf.skippedRows;
    }
    if (summary.added) { tx = current; S.month = null; touch(); }
    draw(true, summary);
    if (summary.added) render({ still: true });
  }

  /* ---------- גיבוי ושחזור ---------- */
  function backupJson() {
    return JSON.stringify(C.createBackup(tx, settings, APP_VERSION));
  }
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function markBackup() { try { localStorage.setItem(KEY_BACKUP, String(Date.now())); } catch { /* לא קריטי */ } }

  async function doBackup(mode) {
    if (!tx.length) { toast('אין עדיין נתונים לגבות. ייבא קבצים קודם.'); return; }
    const name = C.backupFileName();
    const json = backupJson();
    if (mode === 'share' && navigator.canShare && navigator.share) {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'גיבוי הכנסות והוצאות' });
          markBackup(); toast('הגיבוי נשמר. שמור אותו ב-Drive או במייל כדי שלא יאבד.'); render({ still: true });
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
    }
    download(name, json);
    markBackup();
    toast('הגיבוי ירד לקובץ בטלפון (בתיקיית ההורדות). העתק אותו גם ל-Drive.');
    render({ still: true });
  }

  async function doRestorePick() {
    const files = await pickFiles('.json,application/json,text/plain', false);
    if (!files.length) return;
    try {
      const data = C.parseBackup(await files[0].text());
      openSheet('שחזור מגיבוי', `<div class="card col" style="background:var(--alt);box-shadow:none;gap:4px"><div class="strong ellipsis">${esc(files[0].name)}</div><div class="cap">${num(data.transactions.length)} תנועות${data.exportedAt ? ` · נוצר ב-<span class="num">${C.formatDate(data.exportedAt.slice(0, 10))}</span>` : ''}</div>${data.dropped ? `<div class="cap warn">${data.dropped} רשומות פגומות דולגו.</div>` : ''}</div>
        <p class="ink2" style="margin:0">"מיזוג" מוסיף רק תנועות חדשות ומשאיר את הקיימות. "החלפה" מוחקת את הנתונים הנוכחיים ומחליפה אותם בגיבוי.</p>
        <button class="btn" data-act="restore-merge">${ico('call-merge')}מיזוג עם הנתונים הקיימים</button><button class="btn danger" data-act="restore-replace">${ico('swap-horizontal')}החלפת הכול בגיבוי</button>`, { restore: data });
    } catch (e) {
      const msg = e instanceof C.BackupError ? e.message : 'לא הצלחתי לקרוא את קובץ הגיבוי.';
      S.notice = { tone: 'error', text: msg };
      toast(msg);
      if (S.tab === 'more') render({ still: true });
    }
  }

  function applyRestore(mode) {
    const data = sheetCtx && sheetCtx.restore;
    if (!data) return;
    let added;
    if (mode === 'replace') {
      tx = data.transactions;
      settings = { ...data.settings, onboarded: true };
      added = tx.length;
    } else {
      const m = C.mergeBackup(tx, settings, data);
      tx = m.transactions; settings = m.settings; added = m.added;
    }
    S.month = null; S.notice = null;
    persistEnabled = true;
    touch(); flush();
    closeSheet();
    toast(mode === 'replace' ? `הנתונים שוחזרו: ${added.toLocaleString('en-US')} תנועות.` : `נוספו ${added.toLocaleString('en-US')} תנועות חדשות מהגיבוי.`);
    render();
  }

  /* ---------- אירועים ---------- */
  const actions = {
    tab(el) { S.tab = el.dataset.tab; window.scrollTo(0, 0); render(); },
    month(el) { if (!el.dataset.m) return; S.month = el.dataset.m; S.selCat = null; render({ still: true }); },
    'cat-toggle'(el) { S.selCat = S.selCat === el.dataset.id ? null : el.dataset.id; render({ still: true }); },
    'go-tx'(el) {
      S.f = { q: '', type: 'all', cat: el.dataset.cat, src: null, scope: el.dataset.m ? 'month' : 'all' };
      if (el.dataset.m) S.month = el.dataset.m;
      S.tab = 'transactions'; window.scrollTo(0, 0); render();
    },
    import() { openSheet('ייבוא קבצים', importIdleBody()); },
    'import-pick'() { runImport(); },
    'import-done'() { closeSheet(); S.tab = 'overview'; window.scrollTo(0, 0); render(); },
    'sheet-close'() { closeSheet(); },
    period(el) { S.period = el.dataset.v; render({ still: true }); },
    opp(el) { S.openOpp = S.openOpp === el.dataset.id ? null : el.dataset.id; render({ still: true }); },
    tx(el) {
      const t = tx.find((x) => x.id === el.dataset.id);
      if (t) openSheet('פרטי תנועה', txSheetBody(t), { txId: t.id });
    },
    'set-cat'(el) {
      const t = tx.find((x) => x.id === el.dataset.id);
      if (!t) return;
      const all = !!$('#apply-all')?.checked && Number(el.dataset.others) > 0;
      const key = C.normalizeMerchant(t.description);
      tx = tx.map((o) => {
        if (o.id === t.id) return { ...o, category: el.dataset.cat, locked: true };
        if (all && key && !o.locked && C.normalizeMerchant(o.description) === key) return { ...o, category: el.dataset.cat };
        return o;
      });
      if (all && key) settings = { ...settings, merchantRules: { ...settings.merchantRules, [key]: el.dataset.cat } };
      touch(); closeSheet(); render({ still: true });
      toast(all ? 'הסיווג עודכן לכל בית העסק.' : 'הסיווג עודכן.');
    },
    'del-ask'() { $('#del-zone').innerHTML = `<div class="row" style="gap:8px"><button class="btn danger grow" data-act="del-yes">כן, למחוק</button><button class="btn secondary grow" data-act="del-no">ביטול</button></div>`; },
    'del-no'() { $('#del-zone').innerHTML = `<button class="btn ghost compact" style="color:var(--neg)" data-act="del-ask">${ico('trash-can-outline')}מחק תנועה</button>`; },
    'del-yes'() { const id = sheetCtx && sheetCtx.txId; tx = tx.filter((t) => t.id !== id); touch(); closeSheet(); render({ still: true }); toast('התנועה נמחקה.'); },
    ftype(el) { S.f.type = el.dataset.v; refreshTxList(); },
    fscope() { S.f.scope = S.f.scope === 'month' ? 'all' : 'month'; refreshTxList(); },
    'fcat-clear'() { S.f.cat = null; refreshTxList(); },
    'fsrc-clear'() { S.f.src = null; refreshTxList(); },
    'filter-open'() { openSheet('סינון תנועות', filterSheetBody()); },
    fsrc(el) { S.f.src = S.f.src === el.dataset.v ? null : el.dataset.v; setSheetBody(filterSheetBody()); refreshTxList(); },
    fcat(el) { S.f.cat = S.f.cat === el.dataset.v ? null : el.dataset.v; setSheetBody(filterSheetBody()); refreshTxList(); },
    'filter-reset'() { S.f.cat = null; S.f.src = null; setSheetBody(filterSheetBody()); refreshTxList(); },
    'clear-filters'() { S.f = { q: '', type: 'all', cat: null, src: null, scope: 'month' }; render({ still: true }); },
    backup() { doBackup('share'); },
    'backup-download'() { doBackup('download'); },
    restore() { doRestorePick(); },
    'restore-merge'() { applyRestore('merge'); },
    'restore-replace'() { applyRestore('replace'); },
    income() {
      openSheet('הכנסה חודשית צפויה', `<p class="ink2" style="margin:0">הסכום נטו שנכנס לך בדרך כלל בחודש. אם ההכנסה בפועל גבוהה יותר, האפליקציה תשתמש בה.</p>
        <input class="field" id="income-input" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="לדוגמה 12000" value="${settings.expectedIncome ? settings.expectedIncome : ''}" aria-label="הכנסה חודשית צפויה" style="text-align:start">
        <div class="row" style="gap:8px"><button class="btn grow" data-act="income-save">שמירה</button>${settings.expectedIncome > 0 ? '<button class="btn secondary grow" data-act="income-clear">הסרה</button>' : ''}</div>`);
      setTimeout(() => $('#income-input')?.focus(), 350);
    },
    'income-save'() {
      const n = Number(($('#income-input').value || '').replace(/[^\d.]/g, ''));
      settings = { ...settings, expectedIncome: Number.isFinite(n) && n > 0 ? Math.round(n) : 0 };
      touch(); closeSheet(); render({ still: true });
    },
    'income-clear'() { settings = { ...settings, expectedIncome: 0 }; touch(); closeSheet(); render({ still: true }); },
    'clear-ask'() {
      openSheet('למחוק את כל הנתונים?', `<p class="ink2" style="margin:0">כל התנועות, הסיווגים וההגדרות יימחקו מהטלפון. אי אפשר לבטל. מומלץ לייצא גיבוי לפני.</p>
        <button class="btn secondary" data-act="clear-backup">${ico('content-save-outline')}ייצוא גיבוי קודם</button><button class="btn danger" data-act="clear-yes">${ico('trash-can-outline')}כן, מחק הכול</button><button class="btn ghost" data-act="sheet-close">ביטול</button>`);
    },
    'clear-backup'() { closeSheet(); setTimeout(() => doBackup('download'), 250); },
    'clear-yes'() { tx = []; settings = { ...C.DEFAULT_SETTINGS, onboarded: true }; S.month = null; persistEnabled = true; touch(); flush(); closeSheet(); render(); toast('כל הנתונים נמחקו.'); },
    install() {
      if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; return; }
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      openSheet('הוספה למסך הבית', ios
        ? `<p class="ink2" style="margin:0">ב-Safari לחץ על כפתור השיתוף ובחר <b>"הוסף למסך הבית"</b>.</p>`
        : `<p class="ink2" style="margin:0">ב-Chrome לחץ על תפריט שלוש הנקודות (⋮) ובחר <b>"התקנת האפליקציה"</b> או <b>"הוספה למסך הבית"</b>. מאותו רגע היא תיפתח כמו אפליקציה רגילה, גם בלי אינטרנט.</p>`
        + '<button class="btn block" data-act="sheet-close">הבנתי</button>');
    },
    'retry-load'() { loadError = false; persistEnabled = true; load(); render(); },
    'raw-download'() { download('raw-data-backup.json', JSON.stringify({ transactions: localStorage.getItem(KEY_TX), settings: localStorage.getItem(KEY_SET) })); },
    'reset-load'() { tx = []; settings = { ...C.DEFAULT_SETTINGS }; loadError = false; persistEnabled = true; dirty = true; flush(); render(); },
  };

  document.addEventListener('click', (e) => {
    const back = e.target.closest('.sheet-back');
    if (back && e.target === back) { closeSheet(); return; }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el);
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'q') { S.f.q = e.target.value; refreshTxList(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else { const t = C.todayISO(); if (t !== today) { today = t; derivedCache = null; render({ still: true }); } }
  });
  window.addEventListener('pagehide', flush);

  /* ---------- הפעלה ---------- */
  load();
  render();
  requestAnimationFrame(() => { const b = $('#boot'); b.classList.add('gone'); setTimeout(() => b.remove(), 400); });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
