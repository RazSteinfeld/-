(() => {
  'use strict';
  const C = window.Core;
  const KEY = 'attendance.v1';
  const MAX_SHIFT_H = 16;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- state ---------- */
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY));
      if (o) return { settings: { ...clone(C.DEFAULT_SETTINGS), ...o.settings }, shifts: Array.isArray(o.shifts) ? o.shifts : [] };
    } catch (e) { /* ignore */ }
    return { settings: clone(C.DEFAULT_SETTINGS), shifts: [] };
  }
  let state = load();
  const today = new Date();
  const view = { y: today.getFullYear(), m: today.getMonth() };

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('לא ניתן לשמור – האחסון בדפדפן חסום'); }
  }
  const openShift = () => state.shifts.find((s) => s.end == null);

  /* ---------- format ---------- */
  const money = (n) => '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hmm = (min) => { const m = Math.round(min); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
  const clock = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const hms = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`; };
  const monthTitle = () => new Date(view.y, view.m, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  const toInput = (ms) => { const d = new Date(ms); return `${C.dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromInput = (v) => (v ? new Date(v).getTime() : NaN);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const ICON = {
    prev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  };

  /* ---------- toast ---------- */
  let toastTimer;
  let toastUndo = null;
  function toast(msg, undo) {
    const t = $('#toast');
    toastUndo = undo || null;
    t.innerHTML = esc(msg) + (undo ? ' <button type="button" class="toast-btn" data-act="toast-undo">בטל</button>' : '');
    t.classList.toggle('has-btn', !!undo);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove('show'); toastUndo = null; }, undo ? 6000 : 3200);
  }

  /* ---------- render ---------- */
  function render() {
    const open = openShift();
    const sum = C.monthSummary(state.shifts, view.y, view.m, state.settings);
    $('#app').innerHTML = `
      <div class="bar">
        <div class="month">
          <button class="icon-btn" data-act="month" data-d="-1" aria-label="חודש קודם">${ICON.prev}</button>
          <h1>${esc(monthTitle())}</h1>
          <button class="icon-btn" data-act="month" data-d="1" aria-label="חודש הבא">${ICON.next}</button>
        </div>
        <button class="icon-btn" data-act="settings" aria-label="הגדרות">${ICON.gear}</button>
      </div>

      <section class="hero">
        <div class="hero-top">
          <span class="status ${open ? 'on' : ''}">${open ? 'במשמרת' : 'מחוץ למשמרת'}</span>
          <span>${open ? 'מאז ' + clock(open.start) : 'השעה עכשיו'}</span>
        </div>
        <div class="timer num" id="timer">--:--:--</div>
        <div class="live" id="live"></div>
        <div id="stale"></div>
        <button class="punch ${open ? 'out' : ''}" data-act="punch">${open ? 'יציאה' : 'כניסה'}</button>
        <div class="hero-links">
          <button class="link" data-act="add">+ הוספת משמרת ידנית</button>
          ${open ? '<button class="link" data-act="edit" data-id="' + esc(open.id) + '">תיקון שעת כניסה</button>' : ''}
        </div>
      </section>

      <section class="card quick">
        <div class="quick-head">
          <h2>הוספה מהירה</h2>
          <label class="quick-date"><span>תאריך</span><input type="date" id="quick-date" value="${quickDate || C.dateKey(new Date())}"></label>
        </div>
        <div class="presets">${PRESETS.map((p, i) => `<button type="button" class="preset" data-act="quick" data-i="${i}"><b>${p.name}</b><span class="num">${presetLabel(p)}</span></button>`).join('')}</div>
        ${(() => { const c = C.courseShift(new Date(), state.settings); return `<button type="button" class="course-btn" data-act="course"><b>קורס</b><span><span class="num">${state.settings.courseHours}</span> שעות · <span class="num">${clock(c.start)}–${clock(c.end)}</span></span></button>`; })()}
      </section>

      <section class="card summary">
        <div class="big-row">
          <div class="big"><div class="lbl">ברוטו</div><div class="num" id="s-gross"></div></div>
          <div class="big net"><div class="lbl">נטו (משוער)</div><div class="num" id="s-net"></div></div>
        </div>
        <div class="chips">
          <span class="chip">⏱ <b class="num" id="s-hours"></b> שעות</span>
          <span class="chip prem">150%: <b class="num" id="s-prem"></b></span>
          <span class="chip">משמרות: <b id="s-count"></b></span>
        </div>
        <details>
          <summary>פירוט שכר וניכויים</summary>
          <table class="breakdown">
            <tr><td>שעות רגילות (<span class="num" id="b-reg-h"></span>)</td><td class="num" id="b-reg"></td></tr>
            <tr><td>שבת/חג (<span class="num" id="b-prem-h"></span>)</td><td class="num" id="b-prem"></td></tr>
            <tr class="tot"><td>ברוטו</td><td class="num" id="b-gross"></td></tr>
            <tr class="sub"><td>מס הכנסה</td><td class="num" id="b-tax"></td></tr>
            <tr class="sub"><td>ביטוח לאומי</td><td class="num" id="b-ni"></td></tr>
            <tr class="sub"><td>ביטוח בריאות</td><td class="num" id="b-health"></td></tr>
            <tr class="sub"><td>פנסיה (עובד)</td><td class="num" id="b-pen"></td></tr>
            <tr class="tot"><td>נטו</td><td class="num" id="b-net"></td></tr>
          </table>
          <p class="note">הנטו הוא הערכה לפי מדרגות מס 2026 ונקודות הזיכוי שהוגדרו בהגדרות. תלוש השכר הוא המקור המחייב.</p>
        </details>
      </section>

      <div class="list-head"><h2>משמרות החודש</h2></div>
      <section class="card" id="list">${renderList(sum)}</section>
    `;
    updateLive();
  }

  function renderList(sum) {
    if (!sum.rows.length) return '<div class="empty">אין משמרות בחודש הזה.<br>לחץ על "כניסה" או הוסף משמרת ידנית.</div>';
    return sum.rows.map(({ shift: s, calc }) => {
      const d = new Date(s.start);
      const wd = d.toLocaleDateString('he-IL', { weekday: 'short' });
      const endTxt = s.end == null ? '…' : clock(s.end) + (C.dateKey(new Date(s.end)) !== C.dateKey(d) ? ' (+1)' : '');
      const badges = [
        s.end == null ? '<span class="badge live">פעילה</span>' : '',
        s.type === 'course' ? '<span class="badge course">קורס</span>' : '',
        calc.premiumMinutes > 0 ? `<span class="badge">${esc(calc.labels.join(' · ') || '150%')} · 150%</span>` : '',
      ].join('');
      return `<button class="shift" data-act="edit" data-id="${esc(s.id)}">
        <div class="date-chip"><b>${d.getDate()}</b><span>${esc(wd)}</span></div>
        <div>
          <div class="times num">${clock(s.start)} – ${endTxt}</div>
          <div class="meta"><span class="num" id="dur-${esc(s.id)}">${hmm(calc.minutes)}</span> שעות ${badges}${s.note ? ' · ' + esc(s.note) : ''}</div>
        </div>
        <div class="pay num" id="pay-${esc(s.id)}">${money(calc.pay)}</div>
      </button>`;
    }).join('');
  }

  const setText = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };

  function updateLive() {
    const now = Date.now();
    const open = openShift();
    if (open) {
      const c = C.computeShift(open, state.settings, now);
      setText('timer', hms(now - open.start));
      setText('live', 'שכר משמרת עד כה: ' + money(c.pay));
      const stale = (now - open.start) / 3600000 > MAX_SHIFT_H;
      const el = $('#stale');
      if (el) el.innerHTML = stale ? '<div class="warn">המשמרת פתוחה יותר מ-' + MAX_SHIFT_H + ' שעות – אולי שכחת לצאת? לחץ על "תיקון שעת כניסה" או על "יציאה" ותקן אחר כך.</div>' : '';
    } else {
      const d = new Date(now);
      setText('timer', `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
      setText('live', d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }));
    }
    const sum = C.monthSummary(state.shifts, view.y, view.m, state.settings, now);
    setText('s-gross', money(sum.gross));
    setText('s-net', money(sum.net));
    setText('s-hours', hmm(sum.minutes));
    setText('s-prem', hmm(sum.premiumMinutes));
    setText('s-count', String(sum.count));
    setText('b-reg-h', hmm(sum.regularMinutes));
    setText('b-prem-h', hmm(sum.premiumMinutes));
    setText('b-reg', money(sum.regularMinutes / 60 * state.settings.rate));
    setText('b-prem', money(sum.premiumMinutes / 60 * state.settings.rate * state.settings.premiumPct / 100));
    setText('b-gross', money(sum.gross));
    setText('b-tax', '−' + money(sum.incomeTax));
    setText('b-ni', '−' + money(sum.ni));
    setText('b-health', '−' + money(sum.health));
    setText('b-pen', '−' + money(sum.pension));
    setText('b-net', money(sum.net));
    if (open) {
      const row = sum.rows.find((r) => r.shift.id === open.id);
      if (row) { setText('pay-' + open.id, money(row.calc.pay)); setText('dur-' + open.id, hmm(row.calc.minutes)); }
    }
  }

  /* ---------- actions ---------- */
  function punch() {
    const open = openShift();
    const now = Date.now();
    if (!open) {
      state.shifts.push({ id: uid(), start: now, end: null, mode: 'auto', note: '' });
      save(); view.y = today.getFullYear(); view.m = today.getMonth();
      render(); toast('נכנסת למשמרת ב-' + clock(now));
    } else {
      open.end = now;
      save();
      const c = C.computeShift(open, state.settings);
      render(); toast(`משמרת נשמרה: ${hmm(c.minutes)} שעות · ${money(c.pay)}`);
    }
  }

  /* ---------- shift dialog ---------- */
  // משמרות קבועות: שעת התחלה וסיום (סיום מעל 24 = למחרת)
  const PRESETS = [
    { name: 'בוקר', s: 6, e: 14 },
    { name: 'ערב', s: 14, e: 22 },
    { name: 'לילה', s: 22, e: 30 },
  ];
  const presetLabel = (p) => `${pad(p.s)}:00–${pad(p.e % 24)}:00`;

  function applyPreset(p) {
    const cur = $('#f-start').value;
    const day = cur ? new Date(cur) : new Date();
    const at = (h) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h).getTime();
    $('#f-start').value = toInput(at(p.s));
    $('#f-end').value = toInput(at(p.e));
    previewShift();
  }

  function markPresets() {
    const f = readShiftForm();
    document.querySelectorAll('#shift-body .preset').forEach((el) => {
      const p = PRESETS[Number(el.dataset.i)];
      const on = !Number.isNaN(f.start) && f.end !== null && !Number.isNaN(f.end) &&
        clock(f.start) === `${pad(p.s)}:00` && clock(f.end) === `${pad(p.e % 24)}:00` && f.end - f.start === 8 * 3600000;
      el.classList.toggle('on', on);
    });
  }

  let quickDate = null; // null = היום

  const quickDay = () => C.parseKey(($('#quick-date') && $('#quick-date').value) || C.dateKey(new Date()));

  // מוסיף משמרת מוכנה ליום הנבחר, עם הודעת ביטול
  function quickCommit(shift, label, day) {
    state.shifts.push(shift);
    save();
    view.y = day.getFullYear(); view.m = day.getMonth();
    quickDate = null;
    const c = C.computeShift(shift, state.settings);
    render();
    toast(`${label} · ${day.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' })} · ${money(c.pay)}`, () => {
      state.shifts = state.shifts.filter((s) => s !== shift);
      save(); render();
    });
  }

  function quickAdd(p) {
    const day = quickDay();
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), p.s).getTime();
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), p.e).getTime();
    if (state.shifts.some((s) => s.start === start)) { toast(`כבר יש משמרת ${p.name} בתאריך הזה`); return; }
    quickCommit({ id: uid(), start, end, mode: 'auto', note: '' }, `נוספה משמרת ${p.name}`, day);
  }

  function quickCourse() {
    const day = quickDay();
    const key = C.dateKey(day);
    if (state.shifts.some((s) => s.type === 'course' && C.dateKey(new Date(s.start)) === key)) { toast('כבר יש יום קורס בתאריך הזה'); return; }
    quickCommit({ id: uid(), note: '', ...C.courseShift(day, state.settings) }, 'נוסף יום קורס', day);
  }

  let editing = null; // shift object or null for new
  function openShiftDialog(shift) {
    editing = shift || null;
    const base = shift || (() => {
      const d = new Date(); d.setHours(PRESETS[0].s, 0, 0, 0);
      const e = new Date(d); e.setHours(PRESETS[0].e);
      return { start: d.getTime(), end: e.getTime(), mode: 'auto', note: '' };
    })();
    $('#shift-body').innerHTML = `
      <h3>${shift ? 'עריכת משמרת' : 'הוספת משמרת'}</h3>
      <div class="field"><span>משמרת קבועה (התאריך נשאר כמו שנבחר למטה)</span>
        <div class="presets">${PRESETS.map((p, i) => `<button type="button" class="preset" data-act="preset" data-i="${i}"><b>${p.name}</b><span class="num">${presetLabel(p)}</span></button>`).join('')}</div>
      </div>
      <label class="field"><span>כניסה</span><input type="datetime-local" id="f-start" value="${toInput(base.start)}"></label>
      <label class="field"><span>יציאה ${shift && shift.end == null ? '(ריק = עדיין במשמרת)' : ''}</span><input type="datetime-local" id="f-end" value="${base.end == null ? '' : toInput(base.end)}"></label>
      <label class="field"><span>תעריף</span>
        <select id="f-mode">
          <option value="auto" ${base.mode === 'auto' || !base.mode ? 'selected' : ''}>אוטומטי (שבת/חג לפי השעות)</option>
          <option value="regular" ${base.mode === 'regular' ? 'selected' : ''}>הכל תעריף רגיל</option>
          <option value="premium" ${base.mode === 'premium' ? 'selected' : ''}>הכל בתעריף שבת/חג</option>
        </select>
      </label>
      <label class="field"><span>הערה (אופציונלי)</span><input type="text" id="f-note" maxlength="80" value="${esc(base.note)}"></label>
      <div class="preview" id="f-prev"></div>
      <div class="actions">
        ${shift ? '<button class="btn danger" data-act="del">מחיקה</button>' : ''}
        <button class="btn" data-act="close-shift">ביטול</button>
        <button class="btn primary" data-act="save-shift">שמירה</button>
      </div>`;
    $('#shift-dlg').showModal();
    previewShift();
  }

  function readShiftForm() {
    const start = fromInput($('#f-start').value);
    const endRaw = $('#f-end').value;
    const end = endRaw ? fromInput(endRaw) : null;
    return { start, end, mode: $('#f-mode').value, note: $('#f-note').value.trim() };
  }

  function validateShift(f) {
    if (Number.isNaN(f.start)) return 'יש להזין שעת כניסה';
    if (f.end !== null && Number.isNaN(f.end)) return 'שעת יציאה לא תקינה';
    if (f.end !== null && f.end <= f.start) return 'שעת היציאה חייבת להיות אחרי הכניסה';
    if (f.end !== null && (f.end - f.start) / 3600000 > 24) return 'משמרת ארוכה מ-24 שעות – בדוק את התאריכים';
    if (f.end === null && state.shifts.some((s) => s.end == null && s !== editing)) return 'כבר יש משמרת פעילה';
    return null;
  }

  function previewShift() {
    const f = readShiftForm(); const el = $('#f-prev');
    const err = validateShift(f);
    markPresets();
    el.classList.toggle('err', !!err);
    if (err) { el.textContent = err; return; }
    const c = C.computeShift(f, state.settings);
    el.innerHTML = `<b class="num">${hmm(c.minutes)}</b> שעות · <b class="num">${money(c.pay)}</b>` +
      (c.premiumMinutes > 0 ? ` · מתוכן <span class="num">${hmm(c.premiumMinutes)}</span> ב-${state.settings.premiumPct}%${c.labels.length ? ' (' + esc(c.labels.join(', ')) + ')' : ''}` : '');
  }

  function saveShift() {
    const f = readShiftForm(); const err = validateShift(f);
    if (err) { previewShift(); return; }
    if (editing) Object.assign(editing, f);
    else state.shifts.push({ id: uid(), ...f });
    save();
    const d = new Date(f.start); view.y = d.getFullYear(); view.m = d.getMonth();
    $('#shift-dlg').close(); render(); toast('המשמרת נשמרה');
  }

  function deleteShift() {
    if (!editing || !confirm('למחוק את המשמרת?')) return;
    state.shifts = state.shifts.filter((s) => s !== editing);
    save(); $('#shift-dlg').close(); render(); toast('המשמרת נמחקה');
  }

  /* ---------- settings dialog ---------- */
  function renderSettings() {
    const s = state.settings;
    const hols = C.holidayList(view.y, s);
    const row = (h) => `<div class="hol">
        ${h.custom ? '' : `<input type="checkbox" data-hol="${h.key}" ${h.disabled ? '' : 'checked'} aria-label="${esc(h.name)}">`}
        <span class="nm">${esc(h.name)}</span><span class="dt num">${C.parseKey(h.key).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' })}</span>
        ${h.custom ? `<button class="x" data-act="del-hol" data-key="${h.key}" aria-label="הסר">×</button>` : ''}
      </div>`;
    $('#settings-body').innerHTML = `
      <h3>הגדרות</h3>
      <div class="sect">שכר</div>
      <div class="grid2">
        <label class="field"><span>שכר לשעה (₪)</span><input type="number" inputmode="decimal" step="0.01" min="0" data-set="rate" value="${s.rate}"></label>
        <label class="field"><span>שבת/חג (% מהשכר)</span><input type="number" inputmode="numeric" step="1" min="100" data-set="premiumPct" value="${s.premiumPct}"></label>
        <label class="field"><span>התחלת תעריף מוגדל (שישי)</span><input type="time" data-set="premiumStart" value="${s.premiumStart}"></label>
        <label class="field"><span>סיום (ראשון)</span><input type="time" data-set="premiumEnd" value="${s.premiumEnd}"></label>
      </div>
      <div class="sect">חישוב נטו</div>
      <div class="grid2">
        <label class="field"><span>נקודות זיכוי</span><input type="number" inputmode="decimal" step="0.25" min="0" data-set="creditPoints" value="${s.creditPoints}"></label>
        <label class="field"><span>פנסיה – הפרשת עובד (%)</span><input type="number" inputmode="decimal" step="0.1" min="0" data-set="pensionPct" value="${s.pensionPct}"></label>
      </div>
      <div class="sect">יום קורס (בתעריף רגיל)</div>
      <div class="grid2">
        <label class="field"><span>שעות ליום קורס</span><input type="number" inputmode="decimal" step="0.5" min="0" data-set="courseHours" value="${s.courseHours}"></label>
        <label class="field"><span>שעת התחלה</span><input type="time" data-set="courseStart" value="${s.courseStart}"></label>
      </div>
      <div class="sect">חגים ${view.y} (מזוהים אוטומטית)</div>
      <div>${hols.map(row).join('') || '<div class="empty">אין חגים</div>'}
        <div class="add-hol"><input type="date" id="hol-date"><button class="btn" data-act="add-hol">הוסף יום חג</button></div>
      </div>
      <div class="sect">גיבוי</div>
      <div class="actions">
        <button class="btn" data-act="export">ייצוא גיבוי</button>
        <button class="btn" data-act="import">ייבוא גיבוי</button>
        <button class="btn" data-act="csv">CSV לחודש</button>
      </div>
      <input type="file" id="import-file" accept="application/json" hidden>
      <div class="actions"><button class="btn primary" data-act="close-settings">סגירה</button></div>`;
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportCsv() {
    const sum = C.monthSummary(state.shifts, view.y, view.m, state.settings);
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['תאריך', 'כניסה', 'יציאה', 'שעות', 'שעות 150%', 'שכר', 'הערה'].map(q).join(',')];
    for (const { shift: s, calc } of [...sum.rows].reverse()) {
      lines.push([C.dateKey(new Date(s.start)), clock(s.start), s.end == null ? '' : clock(s.end), hmm(calc.minutes), hmm(calc.premiumMinutes), calc.pay.toFixed(2), [s.type === 'course' ? 'קורס' : '', s.note || ''].filter(Boolean).join(' – ')].map(q).join(','));
    }
    lines.push(['סה"כ ברוטו', '', '', hmm(sum.minutes), hmm(sum.premiumMinutes), sum.gross.toFixed(2), ''].map(q).join(','));
    lines.push(['נטו משוער', '', '', '', '', sum.net.toFixed(2), ''].map(q).join(','));
    download(`attendance-${view.y}-${pad(view.m + 1)}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  function importBackup(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(r.result);
        if (!o || !Array.isArray(o.shifts)) throw new Error('bad');
        const clean = o.shifts.filter((s) => Number.isFinite(s.start) && (s.end == null || Number.isFinite(s.end)))
          .map((s) => ({ id: String(s.id || uid()), start: s.start, end: s.end ?? null, mode: s.mode || 'auto', note: String(s.note || ''), ...(s.type === 'course' ? { type: 'course' } : {}) }));
        if (!confirm(`לשחזר ${clean.length} משמרות? הנתונים הנוכחיים יוחלפו.`)) return;
        state = { settings: { ...clone(C.DEFAULT_SETTINGS), ...o.settings }, shifts: clean };
        save(); renderSettings(); render(); toast('הגיבוי שוחזר');
      } catch (e) { toast('קובץ גיבוי לא תקין'); }
    };
    r.readAsText(file);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const act = t.dataset.act;
    switch (act) {
      case 'punch': punch(); break;
      case 'add': openShiftDialog(null); break;
      case 'edit': { const s = state.shifts.find((x) => x.id === t.dataset.id); if (s) openShiftDialog(s); break; }
      case 'month': { const d = new Date(view.y, view.m + Number(t.dataset.d), 1); view.y = d.getFullYear(); view.m = d.getMonth(); render(); break; }
      case 'settings': renderSettings(); $('#settings-dlg').showModal(); break;
      case 'close-settings': $('#settings-dlg').close(); break;
      case 'close-shift': $('#shift-dlg').close(); break;
      case 'preset': applyPreset(PRESETS[Number(t.dataset.i)]); break;
      case 'quick': quickAdd(PRESETS[Number(t.dataset.i)]); break;
      case 'course': quickCourse(); break;
      case 'toast-undo': if (toastUndo) { const u = toastUndo; toastUndo = null; u(); toast('בוטל'); } break;
      case 'save-shift': saveShift(); break;
      case 'del': deleteShift(); break;
      case 'add-hol': {
        const v = $('#hol-date').value; if (!v) break;
        if (!state.settings.extraHolidays.includes(v)) state.settings.extraHolidays.push(v);
        save(); renderSettings(); render(); break;
      }
      case 'del-hol':
        state.settings.extraHolidays = state.settings.extraHolidays.filter((k) => k !== t.dataset.key);
        save(); renderSettings(); render(); break;
      case 'export': download(`attendance-backup-${C.dateKey(new Date())}.json`, JSON.stringify(state, null, 2), 'application/json'); break;
      case 'import': $('#import-file').click(); break;
      case 'csv': exportCsv(); break;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.closest('#shift-body')) { previewShift(); return; }
    const k = e.target.dataset.set;
    if (k) {
      const el = e.target;
      state.settings[k] = el.type === 'number' ? (el.value === '' ? C.DEFAULT_SETTINGS[k] : parseFloat(el.value)) : (el.value || C.DEFAULT_SETTINGS[k]);
      save(); updateLive(); render();
      // render() בונה מחדש רק את הדף הראשי, אז שדות ההגדרות נשארים עם המיקוד
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'quick-date') quickDate = e.target.value || null;
    const h = e.target.dataset.hol;
    if (h) {
      const set = new Set(state.settings.disabledHolidays);
      if (e.target.checked) set.delete(h); else set.add(h);
      state.settings.disabledHolidays = [...set];
      save(); render();
    }
    if (e.target.id === 'import-file' && e.target.files[0]) importBackup(e.target.files[0]);
  });

  /* ---------- boot ---------- */
  render();
  setInterval(updateLive, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateLive(); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
