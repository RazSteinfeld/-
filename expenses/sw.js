const CACHE = 'expenses-v1';
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'core.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png',
  'fonts/Heebo_400Regular.ttf', 'fonts/Heebo_600SemiBold.ttf', 'fonts/Heebo_800ExtraBold.ttf',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// רשת קודם (כדי שעדכונים יגיעו), ומטמון כגיבוי לעבודה בלי אינטרנט.
// נוגעים רק בקבצים של האפליקציה עצמה – לא נשלח שום מידע החוצה.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
