import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** בוחר קבצי Excel/CSV (אפשר כמה יחד). מחזיר null אם המשתמש ביטל. */
export async function pickDataFiles(): Promise<File[] | null> {
  const res = await File.pickFileAsync({ multipleFiles: true, mimeTypes: ['*/*'] });
  if (res.canceled) return null;
  return res.result;
}

export async function pickBackupFile(): Promise<{ name: string; text: string } | null> {
  const res = await File.pickFileAsync({ multipleFiles: false, mimeTypes: ['*/*'] });
  if (res.canceled) return null;
  return { name: res.result.name, text: await res.result.text() };
}

/** שומר גיבוי כקובץ JSON ופותח את תפריט השיתוף של Android (Drive, קבצים, וואטסאפ ועוד). */
export async function shareBackupFile(fileName: string, json: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(json);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('שיתוף קבצים לא זמין במכשיר הזה.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'שמירת גיבוי הכנסות והוצאות',
  });
}
