// בונה את core.js (הלוגיקה + קורא ה-Excel) ואת קובץ האייקונים.
// הרצה: npm run build.  הקבצים שנוצרים נשמרים בגיט, כך שאין שלב בנייה בשרת.
import fs from 'node:fs';
import * as esbuild from 'esbuild';
import * as mdi from '@mdi/js';

const UI_ICONS = [
  'chart-donut', 'swap-vertical', 'piggy-bank', 'dots-grid', 'file-upload-outline', 'chevron-left', 'chevron-right',
  'chevron-up', 'chevron-down', 'magnify', 'close', 'close-circle', 'tune-variant', 'arrow-up', 'arrow-down',
  'calendar-month-outline', 'infinity', 'trash-can-outline', 'shield-lock-outline', 'content-save-outline',
  'backup-restore', 'cash-plus', 'alert-circle-outline', 'information-outline', 'check-circle-outline',
  'alert-octagon-outline', 'calendar-clock', 'autorenew', 'trending-down', 'speedometer', 'alert-outline',
  'check-circle', 'alert-circle', 'file-excel-outline', 'folder-open-outline', 'credit-card-outline', 'bank-outline',
  'pencil-outline', 'calendar-today', 'arrow-up-circle-outline', 'arrow-down-circle-outline', 'file-chart-outline',
  'receipt-text-outline', 'text-search-variant', 'call-merge', 'check-bold', 'calendar-sync-outline', 'swap-horizontal',
  'download', 'plus', 'cog-outline', 'home-import-outline',
];

const cats = fs.readFileSync('src/categories.ts', 'utf8');
const catIcons = [...cats.matchAll(/icon: '([^']+)'/g)].map((m) => m[1]);
const names = [...new Set([...UI_ICONS, ...catIcons])].sort();
const camel = (n) => 'mdi' + n.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const missing = names.filter((n) => !mdi[camel(n)]);
if (missing.length) {
  console.error('אייקונים חסרים ב-@mdi/js:', missing.join(', '));
  process.exit(1);
}
const data = Object.fromEntries(names.map((n) => [n, mdi[camel(n)]]));
fs.writeFileSync(
  'src/icons-data.ts',
  `// נוצר אוטומטית ע"י build.mjs מתוך @mdi/js. אל תערוך ידנית.\nexport const ICON_PATHS: Record<string, string> = ${JSON.stringify(data)};\n`,
);

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'Core',
  platform: 'browser',
  target: ['es2019', 'chrome80'],
  outfile: 'core.js',
  legalComments: 'none',
  logLevel: 'info',
});
