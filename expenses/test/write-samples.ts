// יוצר קבצי דוגמה (Max, בנק, CSV) לבדיקת הייבוא בדפדפן: npx tsx test/write-samples.ts <תיקייה>
import fs from 'node:fs';
import path from 'node:path';
import { bankCsvWin1255, bankWorkbook, maxWorkbook } from './fixtures';

const dir = process.argv[2] ?? 'samples-out';
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'max-sample.xlsx'), maxWorkbook());
fs.writeFileSync(path.join(dir, 'bank-sample.xlsx'), bankWorkbook());
fs.writeFileSync(path.join(dir, 'bank-win1255.csv'), bankCsvWin1255());
fs.writeFileSync(path.join(dir, 'not-a-table.csv'), 'שלום,עולם\n1,2\n');
console.log('נכתב אל', dir);
