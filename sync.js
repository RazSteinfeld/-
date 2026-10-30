/* סנכרון לענן: הנתונים נשמרים ב-Gist פרטי (secret) בחשבון GitHub של המשתמש.
   הטוקן נשמר רק במכשיר, ונשלח רק אל api.github.com. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const API = 'https://api.github.com';
  const DESC = 'attendance-app-data';
  const FILE = 'attendance.json';
  const KEY = 'attendance.sync.v1';
  const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=' + encodeURIComponent('attendance-app');

  class SyncError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }

  /* ---------- הגדרות מקומיות: {token, gistId, login, etag, lastSync} ---------- */
  function getConfig() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  function setConfig(cfg) {
    try { if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg)); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  async function request(token, path, opts = {}) {
    let res;
    try {
      res = await fetch(API + path, {
        cache: 'no-store',
        ...opts,
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
          ...(opts.headers || {}),
        },
      });
    } catch (e) {
      throw new SyncError('network', 'אין חיבור לאינטרנט');
    }
    if (res.status === 401) throw new SyncError('auth', 'הטוקן לא תקין או שפג תוקפו');
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      throw new SyncError(remaining === '0' ? 'rate' : 'forbidden', remaining === '0' ? 'חרגת ממגבלת הבקשות, נסה שוב מאוחר יותר' : 'אין לטוקן הרשאה ל-Gists');
    }
    if (res.status === 404) throw new SyncError('notfound', 'הגיבוי בענן לא נמצא');
    return res;
  }

  /** בודק טוקן ומחפש גיבוי קיים. מחזיר {login, gistId|null} */
  async function connect(token) {
    token = String(token || '').trim();
    if (!token) throw new SyncError('auth', 'הדבק את הטוקן');
    const res = await request(token, '/user');
    if (!res.ok) throw new SyncError('http', 'שגיאה בהתחברות (' + res.status + ')');
    const scopes = res.headers.get('x-oauth-scopes');
    if (scopes !== null && !scopes.split(',').map((x) => x.trim()).includes('gist')) {
      throw new SyncError('scope', 'לטוקן חסרה הרשאת gist – צור טוקן חדש דרך הכפתור');
    }
    const { login } = await res.json();
    for (let page = 1; page <= 5; page++) {
      const r = await request(token, `/gists?per_page=100&page=${page}`);
      if (!r.ok) throw new SyncError('http', 'שגיאה בקריאת הגיבויים (' + r.status + ')');
      const list = await r.json();
      const found = list.find((g) => g.description === DESC && g.files && g.files[FILE]);
      if (found) return { login, gistId: found.id };
      if (list.length < 100) break;
    }
    return { login, gistId: null };
  }

  async function create(token, data) {
    const res = await request(token, '/gists', {
      method: 'POST',
      body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(data) } } }),
    });
    if (!res.ok) throw new SyncError('http', 'יצירת הגיבוי נכשלה (' + res.status + ')');
    const g = await res.json();
    return { gistId: g.id, etag: res.headers.get('etag') };
  }

  /** קורא את הגיבוי. אם לא השתנה מאז ה-etag – {notModified: true} */
  async function pull(cfg) {
    const res = await request(cfg.token, '/gists/' + cfg.gistId, cfg.etag ? { headers: { 'If-None-Match': cfg.etag } } : {});
    if (res.status === 304) return { notModified: true };
    if (!res.ok) throw new SyncError('http', 'קריאת הגיבוי נכשלה (' + res.status + ')');
    const g = await res.json();
    const f = g.files && g.files[FILE];
    if (!f) throw new SyncError('notfound', 'קובץ הגיבוי לא נמצא');
    let text = f.content;
    if (f.truncated && f.raw_url) {
      const raw = await fetch(f.raw_url, { cache: 'no-store' });
      text = await raw.text();
    }
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new SyncError('format', 'קובץ הגיבוי פגום'); }
    return { data, etag: res.headers.get('etag') };
  }

  async function push(cfg, data) {
    const res = await request(cfg.token, '/gists/' + cfg.gistId, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(data) } } }),
    });
    if (!res.ok) throw new SyncError('http', 'שמירה בענן נכשלה (' + res.status + ')');
    return { etag: res.headers.get('etag') };
  }

  return { TOKEN_URL, SyncError, getConfig, setConfig, connect, create, pull, push };
});
