export type Source = 'card' | 'bank' | 'manual';

export interface Installment {
  /** מספר התשלום הנוכחי (1 עד total) */
  index: number;
  total: number;
  /** סכום העסקה המלא, אם ידוע */
  originalAmount?: number;
}

export interface Transaction {
  /** מזהה יציב שמשמש למניעת כפילויות */
  id: string;
  /** תאריך אפקטיבי (YYYY-MM-DD) שלפיו התנועה משויכת לחודש */
  date: string;
  /** תאריך הרכישה המקורי, אם שונה מהתאריך האפקטיבי (תשלומים) */
  purchaseDate?: string;
  description: string;
  /** שקלים: חיובי = כסף נכנס, שלילי = כסף יוצא */
  amount: number;
  source: Source;
  category: string;
  /** סווג ידנית על ידי המשתמש – לא נדרס בייבוא חוזר */
  locked?: boolean;
  installment?: Installment;
  note?: string;
  cardLast4?: string;
  importedAt: string;
}

export type RawTransaction = Omit<Transaction, 'id' | 'category' | 'importedAt' | 'locked'> & {
  /** קטגוריה שהקובץ עצמו סיפק (למשל מ-Max) */
  sourceCategory?: string;
};

export interface Settings {
  /** הכנסה חודשית צפויה (0 = לא הוגדר) */
  expectedIncome: number;
  /** כללי "בית עסק ← קטגוריה" שנלמדו מהמשתמש */
  merchantRules: Record<string, string>;
  /** המשתמש כבר ראה את מסך הפתיחה */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  expectedIncome: 0,
  merchantRules: {},
  onboarded: false,
};

export interface BackupFile {
  app: 'hachnasot-vehotzaot';
  schema: 1;
  exportedAt: string;
  appVersion: string;
  settings: Settings;
  transactions: Transaction[];
}
