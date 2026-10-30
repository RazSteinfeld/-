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
      if (o) {
        return {
          settings: { ...clone(C.DEFAULT_SETTINGS), ...o.settings },
          shifts: Array.isArray(o.shifts) ? o.shifts : [],
          deleted: o.deleted && typeof o.deleted === 'object' ? o.deleted : {},
          settingsAt: Number(o.settingsAt) || 0,
        };
      }
    } catch (e) { /* ignore */ }
    return { settings: clone(C.DEFAULT_SETTINGS), shifts: [], deleted: {}, settingsAt: 0 };
  }
  let state = load();
  const today = new Date();
  const view = { y: today.getFullYear(), m: today.getMonth() };

  /* תיוג שינויים לסנכרון: לכל משמרת u = זמן עדכון, מחיקות נרשמות כ"מצבה", והגדרות – settingsAt */
  const snap = { shifts: new Map(), settings: '' };
  const shiftJson = (sh) => { const { u, ...rest } = sh; return JSON.stringify(rest); };
  function resnap() {
    snap.shifts = new Map(state.shifts.map((sh) => [sh.id, shiftJson(sh)]));
    snap.settings = JSON.stringify(state.settings);
  }
  function stamp() {
    const now = Date.now(), seen = new Set();
    for (const sh of state.shifts) {
      seen.add(sh.id);
      const j = shiftJson(sh);
      if (snap.shifts.get(sh.id) !== j) { sh.u = now; snap.shifts.set(sh.id, j); }
    }
    for (const id of [...snap.shifts.keys()]) {
      if (!seen.has(id)) { snap.shifts.delete(id); state.deleted[id] = now; }
    }
    const sj = JSON.stringify(state.settings);
    if (sj !== snap.settings) { state.settingsAt = now; snap.settings = sj; }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('לא ניתן לשמור – האחסון בדפדפן חסום'); }
  }
  let saveSeq = 0;
  function save() {
    stamp(); persist(); saveSeq++;
    const cfg = Sync.getConfig();
    if (cfg) { if (!cfg.dirty) { cfg.dirty = true; Sync.setConfig(cfg); } scheduleSync(); }
  }
  resnap();
  const openShift = () => state.shifts.find((s) => s.end == null);

  /* ---------- format ---------- */
  const money = (n) => '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // אחוז בתוך טקסט עברי: מבודד כדי שהסימן % לא יתהפך (למשל "ב-125%")
  const pctTxt = (p) => '\u2066' + p + '%\u2069';
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
    cloud: '<svg viewBox="0 0 24 24"><path d="M7 18a4 4 0 0 1-.7-7.94A6 6 0 0 1 17.7 8.5 4.5 4.5 0 0 1 17.5 18z"/></svg>',
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

  /* ---------- סנכרון לענן ---------- */
  const cloud = { status: 'off', msg: '' }; // off | idle | syncing | error | offline
  let syncing = false, syncAgain = false, syncTimer = null;
  const dataForSync = () => ({ v: 1, settings: state.settings, settingsAt: state.settingsAt, shifts: state.shifts, deleted: state.deleted });

  function setCloud(status, msg = '') { cloud.status = status; cloud.msg = msg; renderCloudUI(); }

  function renderCloudUI() {
    const cfg = Sync.getConfig();
    const ind = $('#sync-ind');
    if (ind) {
      ind.className = 'icon-btn sync ' + ({ syncing: 'busy', error: 'err', offline: 'warn' }[cloud.status] || 'ok');
      ind.title = cloudLine(cfg);
    }
    const el = $('#cloud-status');
    if (el) { el.textContent = cloudLine(cfg); el.className = 'cloud-status ' + (cloud.status === 'error' ? 'err' : ''); }
  }

  function cloudLine(cfg) {
    if (!cfg) return '';
    if (cloud.status === 'syncing') return 'מסנכרן…';
    if (cloud.status === 'error') return cloud.msg || 'שגיאה בסנכרון';
    if (cloud.status === 'offline') return 'אין חיבור לאינטרנט – יישמר בענן כשהחיבור יחזור';
    return `מחובר ל-GitHub (${cfg.login || ''}) · ` + (cfg.lastSync ? 'סונכרן לאחרונה ב-' + clock(cfg.lastSync) : 'עדיין לא סונכרן');
  }

  function scheduleSync(delay = 2500) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, delay);
  }

  // מחיל נתונים מאוחדים על המצב הנוכחי (משמרות קיימות מתעדכנות במקום, כדי שחלון עריכה פתוח לא יתנתק)
  function applyMerged(m) {
    const local = new Map(state.shifts.map((sh) => [sh.id, sh]));
    state.shifts = m.shifts
      .filter((r) => r && r.id != null && Number.isFinite(r.start))
      .map((r) => {
        const l = local.get(r.id);
        if (!l) return { ...r };
        const copy = { ...r }; // r יכול להיות אותו אובייקט כמו l, לכן מעתיקים לפני שמרוקנים
        for (const k of Object.keys(l)) delete l[k];
        return Object.assign(l, copy);
      });
    state.settings = { ...clone(C.DEFAULT_SETTINGS), ...m.settings };
    state.settingsAt = m.settingsAt; state.deleted = m.deleted;
    resnap(); persist(); render();
  }

  async function syncNow() {
    let cfg = Sync.getConfig();
    if (!cfg) return;
    if (syncing) { syncAgain = true; return; }
    if (!navigator.onLine) { setCloud('offline'); return; }
    syncing = true; clearTimeout(syncTimer);
    const seq = saveSeq;
    setCloud('syncing');
    try {
      const pr = await Sync.pull(cfg);
      let etag = pr.notModified ? cfg.etag : pr.etag;
      let toPush = null;
      if (!pr.notModified) {
        const merged = C.mergeData(dataForSync(), pr.data);
        if (!C.sameData(merged, dataForSync())) applyMerged(merged);
        if (!C.sameData(merged, pr.data)) toPush = dataForSync();
      } else if (cfg.dirty) {
        toPush = dataForSync();
      }
      if (toPush) etag = (await Sync.push(cfg, toPush)).etag;
      cfg = Sync.getConfig();
      if (cfg) { Sync.setConfig({ ...cfg, etag, lastSync: Date.now(), dirty: saveSeq !== seq }); setCloud('idle'); }
    } catch (e) {
      setCloud(e.code === 'network' ? 'offline' : 'error', e.message);
    } finally {
      syncing = false;
      if (syncAgain || saveSeq !== seq) { syncAgain = false; scheduleSync(1500); }
    }
  }

  async function cloudConnect() {
    const msg = (t) => { const el = $('#cloud-msg'); if (el) el.textContent = t; };
    const token = ($('#cloud-token') || {}).value || '';
    msg('מתחבר…');
    try {
      const { login, gistId } = await Sync.connect(token);
      const cfg = { token: token.trim(), login, gistId, etag: null, lastSync: 0, dirty: false };
      if (!gistId) {
        const r = await Sync.create(cfg.token, dataForSync());
        Sync.setConfig({ ...cfg, gistId: r.gistId, etag: r.etag, lastSync: Date.now() });
        setCloud('idle');
        toast('הגיבוי בענן הופעל');
      } else {
        Sync.setConfig(cfg);
        await syncNow();
        toast(cloud.status === 'idle' ? 'נמצא גיבוי קיים – הנתונים אוחדו' : (cloud.msg || 'הסנכרון נכשל'));
      }
      renderSettings(); render();
    } catch (e) { msg(e.message); }
  }

  function cloudDisconnect() {
    if (!confirm('לנתק את הגיבוי בענן? הנתונים שכבר בענן יישארו, אבל שינויים חדשים לא יישמרו שם.')) return;
    Sync.setConfig(null); clearTimeout(syncTimer); setCloud('off');
    renderSettings(); render(); toast('נותק מהענן');
  }

  const cloudBannerOff = () => { try { return localStorage.getItem('attendance.banner') === '0'; } catch (e) { return false; } };

  /* ---------- render ---------- */
  function render() {
    const cloudOn = !!Sync.getConfig();
    const open = openShift();
    const sum = C.monthSummary(state.shifts, view.y, view.m, state.settings);
    $('#app').innerHTML = `
      <div class="bar">
        <div class="month">
          <button class="icon-btn" data-act="month" data-d="-1" aria-label="חודש קודם">${ICON.prev}</button>
          <h1>${esc(monthTitle())}</h1>
          <button class="icon-btn" data-act="month" data-d="1" aria-label="חודש הבא">${ICON.next}</button>
        </div>
        <div class="bar-right">
          ${cloudOn ? `<button class="icon-btn sync ok" id="sync-ind" data-act="settings" aria-label="גיבוי בענן">${ICON.cloud}<i class="sync-dot"></i></button>` : ''}
          <button class="icon-btn" data-act="settings" aria-label="הגדרות">${ICON.gear}</button>
        </div>
      </div>
      ${!cloudOn && !cloudBannerOff() ? `<section class="card cloud-banner">
        <div>הנתונים שמורים רק בטלפון הזה. הפעל גיבוי בענן כדי שלא יאבדו.</div>
        <div class="cloud-banner-act"><button class="btn primary" data-act="settings">הפעלה</button><button class="link-x" data-act="banner-off" aria-label="סגירה">×</button></div>
      </section>` : ''}

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
      </section>

      <section class="card summary">
        <div class="big-row">
          <div class="big"><div class="lbl">ברוטו</div><div class="num" id="s-gross"></div></div>
          <div class="big net"><div class="lbl">נטו (משוער)</div><div class="num" id="s-net"></div></div>
        </div>
        <div class="chips">
          <span class="chip">⏱ <b class="num" id="s-hours"></b> שעות</span>
          <span class="chip prem">בתוספת שכר: <b class="num" id="s-prem"></b></span>
          <span class="chip">משמרות: <b id="s-count"></b></span>
        </div>
        <details>
          <summary>פירוט שכר וניכויים</summary>
          <table class="breakdown">
            <tbody id="b-rows"></tbody>
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
    renderCloudUI();
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
        premBadge(s, calc),
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

  function premBadge(s, calc) {
    const prem = calc.parts.filter((p) => p.pct > 100);
    if (!prem.length) return '';
    const pct = prem.map((p) => p.pct).join('/');
    if (s.mode === 'custom' || s.mode === 'premium') return `<span class="badge">${pctTxt(pct)} · ידני</span>`;
    return `<span class="badge">${esc(calc.labels.join(' · '))} · ${pctTxt(pct)}</span>`;
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
    const rowsEl = $('#b-rows');
    if (rowsEl) {
      const pcts = Object.keys(sum.byPct).map(Number).sort((a, b) => a - b);
      const html = (pcts.length ? pcts : [100]).map((pct) => {
        const min = sum.byPct[pct] || 0;
        return `<tr><td>${pct === 100 ? 'שעות רגילות (' + pctTxt(100) + ')' : 'שעות ב-' + pctTxt(pct)} · <span class="num">${hmm(min)}</span></td><td class="num">${money(min / 60 * state.settings.rate * pct / 100)}</td></tr>`;
      }).join('');
      if (rowsEl.dataset.h !== html) { rowsEl.innerHTML = html; rowsEl.dataset.h = html; }
    }
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
    { name: 'בוקר מאוחר', s: 8, e: 16 },
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
    if (state.shifts.some((s) => s.start === start)) { toast(`כבר יש משמרת שמתחילה ב-${pad(p.s)}:00 בתאריך הזה`); return; }
    quickCommit({ id: uid(), start, end, mode: 'auto', note: '' }, `נוספה משמרת ${p.name}`, day);
  }

  const CUSTOM_PCTS = [125, 150, 200];

  function modeOptions(base) {
    const cur = base.mode === 'custom' ? 'p' + base.pct : (base.mode || 'auto');
    const pcts = [...new Set([...CUSTOM_PCTS, ...(base.mode === 'custom' ? [Number(base.pct)] : [])])].sort((a, b) => a - b);
    const opts = [
      ['auto', 'אוטומטי (שבת/חג לפי השעות)'],
      ['regular', `כל המשמרת ב-${pctTxt(100)} (רגיל)`],
      ...pcts.map((p) => ['p' + p, `כל המשמרת ב-${pctTxt(p)}`]),
      ...(base.mode === 'premium' ? [['premium', `כל המשמרת באחוז שבת/חג (${pctTxt(state.settings.premiumPct)})`]] : []),
    ];
    return opts.map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('');
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
      <label class="field"><span>אחוז שכר</span>
        <select id="f-mode">${modeOptions(base)}</select>
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
    const m = /^p(\d+)$/.exec($('#f-mode').value);
    const mode = m ? 'custom' : $('#f-mode').value;
    return { start, end, mode, pct: m ? Number(m[1]) : undefined, note: $('#f-note').value.trim() };
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
      c.parts.filter((p) => p.pct > 100).map((p) => ` · <span class="num">${hmm(p.ms / 60000)}</span> ב-${pctTxt(p.pct)}`).join('') +
      (c.labels.length ? ' (' + esc(c.labels.join(', ')) + ')' : '');
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
      <div class="sect">חגים ${view.y} (מזוהים אוטומטית)</div>
      <div>${hols.map(row).join('') || '<div class="empty">אין חגים</div>'}
        <div class="add-hol"><input type="date" id="hol-date"><button class="btn" data-act="add-hol">הוסף יום חג</button></div>
      </div>
      <div class="sect">גיבוי בענן (GitHub)</div>
      ${cloudCard()}
      <div class="sect">גיבוי לקובץ</div>
      <div class="actions">
        <button class="btn" data-act="export">ייצוא גיבוי</button>
        <button class="btn" data-act="import">ייבוא גיבוי</button>
        <button class="btn" data-act="csv">CSV לחודש</button>
      </div>
      <input type="file" id="import-file" accept="application/json" hidden>
      <div class="actions"><button class="btn primary" data-act="close-settings">סגירה</button></div>`;
  }

  function cloudCard() {
    const cfg = Sync.getConfig();
    if (cfg) {
      return `<div class="cloud-card">
        <div id="cloud-status" class="cloud-status">${esc(cloudLine(cfg))}</div>
        <p class="note">השינויים נשמרים אוטומטית. אפשר להתחבר עם אותו טוקן גם מטלפון נוסף והנתונים יתאחדו.</p>
        <div class="actions"><button class="btn" data-act="cloud-sync">סנכרן עכשיו</button><button class="btn danger" data-act="cloud-off">ניתוק</button></div>
      </div>`;
    }
    return `<div class="cloud-card">
      <p>הנתונים נשמרים אוטומטית ב-Gist פרטי בחשבון ה-GitHub שלך, ואפשר לשחזר אותם בכל מכשיר. הגדרה חד-פעמית:</p>
      <ol>
        <li>לחץ <a href="${Sync.TOKEN_URL}" target="_blank" rel="noopener">כאן ליצירת טוקן</a>, התחבר ל-GitHub, ובשדה Expiration בחר <b>No expiration</b>.</li>
        <li>לחץ <b>Generate token</b> והעתק את הטוקן (מתחיל ב-<span class="num">ghp_</span>).</li>
        <li>הדבק אותו כאן ולחץ <b>התחברות</b>.</li>
      </ol>
      <input type="password" id="cloud-token" placeholder="הדבק כאן את הטוקן" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div id="cloud-msg" class="cloud-msg" role="status"></div>
      <button class="btn primary" data-act="cloud-connect">התחברות</button>
      <p class="note">הטוקן נשמר רק בטלפון הזה. אפשר לבטל אותו בכל רגע ב-github.com/settings/tokens.</p>
    </div>`;
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
    const lines = [['תאריך', 'כניסה', 'יציאה', 'שעות', 'שעות בתוספת', 'שכר', 'הערה'].map(q).join(',')];
    for (const { shift: s, calc } of [...sum.rows].reverse()) {
      lines.push([C.dateKey(new Date(s.start)), clock(s.start), s.end == null ? '' : clock(s.end), hmm(calc.minutes), hmm(calc.premiumMinutes), calc.pay.toFixed(2), [s.type === 'course' ? 'קורס' : '', s.note || ''].filter(Boolean).join(' – ')].map(q).join(','));
    }
    lines.push(['סה"כ ברוטו', '', '', hmm(sum.minutes), hmm(sum.premiumMinutes), sum.gross.toFixed(2), ''].map(q).join(','));
    lines.push(['נטו משוער', '', '', '', '', sum.net.toFixed(2), ''].map(q).join(','));
    download(`attendance-${view.y}-${pad(view.m + 1)}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  // ממיר זמן מכל פורמט סביר (מספר, מספר כמחרוזת, תאריך ISO) למילי-שניות; NaN אם לא תקין
  const nShifts = (n) => (n === 1 ? 'משמרת אחת' : n + ' משמרות');
  const toMs = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return /^\d+$/.test(v.trim()) ? Number(v) : Date.parse(v);
    return NaN;
  };

  function importBackup(file) {
    const r = new FileReader();
    r.onerror = () => toast('לא ניתן לקרוא את הקובץ');
    r.onload = () => {
      let o;
      try { o = JSON.parse(r.result); } catch (e) { toast('הקובץ אינו קובץ גיבוי (JSON לא תקין)'); return; }
      // תומך בגיבוי רגיל, בגיבוי עטוף ב-state, ובמערך משמרות גולמי
      const src = Array.isArray(o) ? { shifts: o } : (o && o.state && Array.isArray(o.state.shifts) ? o.state : o);
      if (!src || !Array.isArray(src.shifts)) { toast('בקובץ לא נמצאו משמרות – זה לא קובץ גיבוי של האפליקציה'); return; }
      const clean = [];
      for (const s of src.shifts) {
        const start = toMs(s && s.start), end = s && s.end != null ? toMs(s.end) : null;
        if (!Number.isFinite(start) || (end !== null && !Number.isFinite(end))) continue;
        clean.push({ id: String(s.id || uid()), start, end, mode: s.mode || 'auto', ...(s.mode === 'custom' ? { pct: Number(s.pct) || 100 } : {}), note: String(s.note || ''), ...(s.type === 'course' ? { type: 'course' } : {}) });
      }
      const skipped = src.shifts.length - clean.length;
      if (!clean.length) { toast(src.shifts.length ? 'לא נמצאה אף משמרת תקינה בקובץ' : 'הגיבוי ריק – אין בו משמרות'); return; }
      if (state.shifts.length && !confirm(`לשחזר ${nShifts(clean.length)}? הנתונים הנוכחיים (${nShifts(state.shifts.length)}) יוחלפו.`)) return;
      state = { settings: { ...clone(C.DEFAULT_SETTINGS), ...src.settings }, shifts: clean, deleted: { ...state.deleted }, settingsAt: state.settingsAt };
      save();
      // מעבר לחודש של המשמרת האחרונה, כדי שיהיה ברור שהשחזור הצליח
      const latest = new Date(Math.max(...clean.map((x) => x.start)));
      view.y = latest.getFullYear(); view.m = latest.getMonth();
      $('#settings-dlg').close(); render();
      toast(`שוחזרו ${nShifts(clean.length)}` + (skipped ? ` (${skipped} דולגו – לא תקינות)` : '') + ` · מוצג ${monthTitle()}`);
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
      case 'cloud-connect': cloudConnect(); break;
      case 'cloud-sync': syncNow(); break;
      case 'cloud-off': cloudDisconnect(); break;
      case 'banner-off': try { localStorage.setItem('attendance.banner', '0'); } catch (err) { /* ignore */ } render(); break;
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
    if (e.target.id === 'import-file' && e.target.files[0]) { importBackup(e.target.files[0]); e.target.value = ''; }
  });

  /* ---------- boot ---------- */
  render();
  setInterval(updateLive, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { updateLive(); if (Sync.getConfig()) syncNow(); }
    else if (Sync.getConfig()) { clearTimeout(syncTimer); syncNow(); } // נשמר מיד כשעוברים לאפליקציה אחרת
  });
  window.addEventListener('online', () => { if (Sync.getConfig()) syncNow(); });
  setInterval(() => { if (!document.hidden && Sync.getConfig()) syncNow(); }, 60000);
  if (Sync.getConfig()) syncNow();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // כשגרסה חדשה של האפליקציה מותקנת – לטעון מחדש פעם אחת כדי להציג אותה מיד
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
