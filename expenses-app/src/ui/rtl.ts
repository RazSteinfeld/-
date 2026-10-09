import { I18nManager } from 'react-native';

/**
 * האפליקציה כולה בעברית. בטלפון בעברית Android מפעיל RTL מקורי; בטלפון באנגלית ההיפוך
 * ידני. כדי שהמראה יהיה זהה בשני המצבים כל שורה משתמשת ב-ROW (ההתחלה בצד ימין) ויישור
 * הטקסט מוגדר במפורש. נמנעים מ-left/right פיזיים ומרווחים לא סימטריים – משתמשים ב-gap.
 */
export const isRTL = I18nManager.isRTL;

/** שורה שבה הפריט הראשון בצד ימין */
export const ROW = isRTL ? ('row' as const) : ('row-reverse' as const);
/** שורה שבה הפריט הראשון בצד שמאל */
export const ROW_LTR = isRTL ? ('row-reverse' as const) : ('row' as const);

/** חץ "קדימה" בעברית מצביע שמאלה, "אחורה" מצביע ימינה – תמיד פיזי. */
export const CHEVRON_FORWARD = 'chevron-left' as const;
export const CHEVRON_BACK = 'chevron-right' as const;
