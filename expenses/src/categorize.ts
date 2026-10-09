import { getCategory } from './categories';
import type { Source } from './types';

/** מנרמל שם בית עסק: אותיות קטנות, בלי סימני פיסוק ובלי מספרי סניף/אסמכתא. */
export function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // ניקוד
    .replace(/["'`׳״.,*()[\]{}<>:;!?+_\\|#@%^&=~]/g, ' ')
    .replace(/[-–—/]/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Rule {
  cat: string;
  words: string[];
}

/** כללים לתנועות בנק בלבד (חיובי כרטיסי אשראי, חיסכון, העברות). */
const BANK_RULES: Rule[] = [
  {
    cat: 'cc_payment',
    words: [
      'מקס איט', 'max it', 'מקס', 'max', 'ישראכרט', 'isracard', 'כאל', 'כא ל', 'cal', 'לאומי קארד', 'לאומיקארד',
      'ויזה', 'visa', 'אמריקן אקספרס', 'אמקס', 'דיינרס', 'diners', 'כרטיסי אשראי', 'חיוב כרטיס', 'חיוב אשראי',
      'מאסטרקארד', 'mastercard', 'פועלים אקספרס',
    ],
  },
  {
    cat: 'savings',
    words: [
      'פיקדון', 'פקדון', 'חיסכון', 'חסכון', 'קרן השתלמות', 'קופת גמל', 'קופג', 'השקעות', 'ני ע', 'בורסה',
      'מיטב', 'אלטשולר', 'פסגות', 'אקסלנס', 'ילין לפידות', 'מנוף', 'etf', 'ביטוח מנהלים',
    ],
  },
  { cat: 'transfer', words: ['העברה בין חשבונות', 'העברה לחשבון שלי', 'העברה עצמית'] },
  { cat: 'loans', words: ['הלוואה', 'הלואה', 'משכנתא', 'משכנתה', 'פרעון הלוואה', 'פרעון הלואה'] },
  { cat: 'fees', words: ['עמלת', 'עמלה', 'עמלות', 'ריבית חובה', 'ריבית על', 'דמי כרטיס', 'דמי ניהול', 'ריבית'] },
  { cat: 'cash', words: ['משיכת מזומן', 'משיכת מזומנים', 'משיכה מכספומט', 'כספומט', 'משיכה'] },
];

const BANK_INCOME_RULES: Rule[] = [
  { cat: 'refund', words: ['זיכוי', 'החזר', 'ביטול עסקה', 'refund'] },
  { cat: 'salary', words: ['משכורת', 'משכרת', 'שכר', 'משכ', 'תלוש', 'salary', 'payroll'] },
  {
    cat: 'income_other',
    words: ['ביטוח לאומי', 'מס הכנסה', 'קצבה', 'קצבת', 'מענק', 'ביט', 'bit', 'פייבוקס', 'paybox', 'העברה מ', 'הפקדה'],
  },
];

/** כללי בתי עסק – לפי סדר עדיפות (ספציפי לפני כללי). */
const MERCHANT_RULES: Rule[] = [
  { cat: 'delivery', words: ['וולט', 'wolt', 'תן ביס', 'tenbis', '10bis', 'ten bis', 'דליברו', 'משלוחה', 'mishloha', 'גטבק'] },
  { cat: 'subscriptions', words: [
    'netflix', 'נטפליקס', 'spotify', 'ספוטיפיי', 'disney', 'דיסני', 'apple com bill', 'itunes', 'apple services', 'icloud',
    'youtube', 'יוטיוב', 'prime video', 'amazon prime', 'hbo', 'paramount', 'audible', 'dropbox', 'google one',
    'google storage', 'google play', 'openai', 'chatgpt', 'anthropic', 'claude ai', 'github', 'canva', 'adobe',
    'microsoft', 'notion', 'zoom', 'duolingo', 'storytel', 'ביטאון', 'סטינג', 'sting tv', 'yes plus', 'פרי טיוי',
  ] },
  { cat: 'telecom', words: [
    'פלאפון', 'סלקום', 'פרטנר', 'partner', 'cellcom', 'הוט', 'hot mobile', 'hot net', 'ייס', 'בזק', 'bezeq',
    'נטוויז', 'xfone', 'אקספון', 'גולן טלקום', 'golan telecom', 'וי פיי', 'we4g', 'פרי פון', 'רמי לוי תקשורת', 'unlimited',
  ] },
  { cat: 'utilities', words: [
    'חברת החשמל', 'חח י', 'מקורות', 'תאגיד מים', 'מי אביבים', 'מי רעננה', 'מי שבע', 'מים', 'סופרגז',
    'אמישראגז', 'פזגז', 'גז', 'דלק גז',
  ] },
  { cat: 'insurance', words: [
    'ביטוח', 'הראל', 'מגדל', 'הפניקס', 'כלל ביטוח', 'מנורה', 'איילון', 'שומרה', 'ליברה', 'ביטוח ישיר', 'ווי ביטוח',
    '9 מילניום', 'עזר ביטוח', 'שלמה ביטוח', 'ai ביטוח',
  ] },
  { cat: 'housing', words: [
    'ארנונה', 'עירייה', 'עיריית', 'מועצה', 'ועד בית', 'שכר דירה', 'שכירות', 'איקאה', 'ikea', 'הום סנטר', 'home center',
    'אייס', 'ace', 'נגריה', 'חשמלאי', 'אינסטלטור', 'ריהוט', 'רהיטי', 'שיפוץ', 'תמרור', 'טמבור', 'צבעים',
  ] },
  { cat: 'car', words: [
    'פז', 'סונול', 'דלק', 'דור אלון', 'delek', 'ten ', 'טן', 'פנגו', 'pango', 'סלופארק', 'cellopark', 'חניון', 'חניה',
    'אחוזות החוף', 'כביש 6', 'כביש חוצה', 'מוסך', 'צמיגים', 'טסט', 'רישוי', 'משרד הרישוי', 'קורקינט', 'לאנצ',
    'שלמה סיקסט', 'מנטה', 'yellow', 'דרך ארץ', 'נתיבי איילון', 'אלון גז',
  ] },
  { cat: 'transport', words: [
    'רב קו', 'רבקו', 'רכבת ישראל', 'רכבת', 'אגד', 'דן ', 'אוטובוס', 'מוניות', 'gett', 'גט טקסי', 'yango', 'uber',
    'אובר', 'bolt', 'סופרבוס', 'מטרופולין', 'קווים', 'נתיב אקספרס', 'moovit', 'הרכבת הקלה', 'תחבורה ציבורית', 'מונית',
  ] },
  { cat: 'health', words: [
    'קופת חולים', 'מכבי', 'כללית', 'מאוחדת', 'לאומית שירותי', 'סופר פארם', 'super pharm', 'superpharm', 'ניו פארם',
    'new pharm', 'בית מרקחת', 'רופא', 'שיניים', 'דנטל', 'מרפאה', 'אופטיקה', 'משקפיים', 'פיזיו', 'רפואי', 'אסותא',
    'איכילוב', 'הדסה', 'רפואה', 'מעבדה', 'תרופות', 'אוניקס', 'נטורה',
  ] },
  { cat: 'pets', words: ['וטרינר', 'פט שופ', 'petshop', 'פטס', 'חיות מחמד', 'אנימל', 'חיות', 'pet '] },
  { cat: 'education', words: [
    'גן ילדים', 'צהרון', 'בית ספר', 'אוניברסיטה', 'מכללה', 'קורס', 'udemy', 'coursera', 'חוג', 'שיעור פרטי',
    'משרד החינוך', 'סמינר', 'תנועת נוער', 'שכר לימוד', 'ספרים',
  ] },
  { cat: 'beauty', words: ['מספרה', 'ספא', 'spa', 'קוסמטיקה', 'קוסמטיקאית', 'מניקור', 'ספרינג', 'sephora', 'סלון יופי', 'ביוטי', 'פדיקור', 'איפור'] },
  { cat: 'travel', words: [
    'airbnb', 'booking', 'בוקינג', 'אל על', 'el al', 'ישראייר', 'ארקיע', 'arkia', 'wizz', 'ryanair', 'easyjet', 'מלון',
    'hotel', 'טיסה', 'טיסות', 'agoda', 'expedia', 'דיוטי פרי', 'duty free', 'נמל תעופה', 'נתב ג', 'אשראי בחול', 'trip com',
  ] },
  { cat: 'leisure', words: [
    'סינמה', 'cinema', 'yes planet', 'סרט', 'הבימה', 'eventim', 'לאן', 'leaan', 'כרטיסים', 'tickets', 'בולינג',
    'לונה פארק', 'ספארי', 'הולמס פלייס', 'holmes place', 'גו אקטיב', 'go active', 'חדר כושר', 'סטודיו', 'steam',
    'playstation', 'nintendo', 'xbox', 'באולינג', 'קייטנה', 'אטרקציה', 'מוזיאון', 'תיאטרון', 'הופעה', 'סינמטק',
  ] },
  { cat: 'gifts', words: ['תרומה', 'עמותה', 'צדקה', 'מתנה', 'מתנות', 'פרחים', 'פרחי', 'gift'] },
  { cat: 'clothing', words: [
    'זארה', 'zara', 'h&m', 'h m', 'קסטרו', 'castro', 'פוקס', 'fox', 'גולף', 'golf', 'רנואר', 'renuar', 'טרמינל',
    'terminal x', 'shein', 'שיין', 'נעלי', 'אדידס', 'adidas', 'nike', 'נייקי', 'פולגת', 'הודיס', 'american eagle',
    'מנגו', 'mango', 'בגדי', 'ביגוד', 'הנעלה', 'דלתא', 'delta', 'גאפ', 'gap', 'ברשקה', 'bershka', 'pull bear',
    'stradivarius', 'לי קופר', 'אופנה',
  ] },
  { cat: 'shopping', words: [
    'amazon', 'אמזון', 'aliexpress', 'עלי אקספרס', 'ebay', 'איביי', 'ksp', 'באג', 'bug ', 'ivory', 'איבורי',
    'מחסני חשמל', 'אלקטרה', 'electra', 'temu', 'טמו', 'סטימצקי', 'steimatzky', 'צומת ספרים', 'next', 'נקסט',
    'pandora', 'פנדורה', 'office depot', 'אופיס דיפו', 'מחסני להב', 'מחסני תאורה', 'ד נ א', 'dna',
    'ביי מי', 'buyme', 'שילב', 'toys', 'טויס', 'צעצוע', 'כלי בית', 'אלקטרוניקה', 'מחשבים', 'סלולר',
  ] },
  { cat: 'dining', words: [
    'מסעדה', 'מסעדת', 'קפה', 'coffee', 'cafe', 'ארומה', 'aroma', 'קופי בין', 'coffee bean', 'גרג', 'greg', 'לנדוור',
    'landwer', 'מקדונלד', 'mcdonald', 'בורגר', 'burger', 'פיצה', 'pizza', 'דומינו', 'domino', 'פאפא ג', 'שווארמה',
    'פלאפל', 'סושי', 'sushi', 'פאב', 'pub ', 'גלידה', 'חומוס', 'בייגל', 'מאפה', 'מאפיה', 'מאפיית', 'קונדיטוריה',
    'רולדין', 'ג חנון', 'האחים', 'שגב', 'קיוסק', 'פלאפל', 'ברבקיו', 'סטייק', 'בר ', 'ביסטרו', 'מזנון', 'מטבח', 'פיצרייה', 'wok', 'וואקי', 'אגאדיר', 'ניו יורק', 'איטלקית', 'אסיאתית', 'מסעדות',
  ] },
  { cat: 'groceries', words: [
    'שופרסל', 'רמי לוי', 'יוחננוף', 'ויקטורי', 'מגה', 'טיב טעם', 'אושר עד', 'חצי חינם', 'סופר ', 'מינימרקט',
    'מכולת', 'am pm', 'ampm', 'יינות ביתן', 'קשת טעמים', 'פרש מרקט', 'ירקות', 'פירות', 'קצבייה', 'קצביה',
    'carrefour', 'קרפור', 'סיטי מרקט', 'מחסני השוק', 'שוק ', 'סופר דוש', 'נתיב החסד', 'גולדה', 'מעדניית',
    'חנות הטבע', 'פירות וירקות', 'סופרמרקט', 'זול ובגדול', 'סופר יודה', 'שפע שוק',
  ] },
];

/** קטגוריות Max ← קטגוריות שלנו (לפי מילות מפתח). */
const SOURCE_CATEGORY_MAP: Rule[] = [
  { cat: 'dining', words: ['מסעדות', 'בתי קפה', 'קפה'] },
  { cat: 'groceries', words: ['מזון', 'סופר'] },
  { cat: 'leisure', words: ['פנאי', 'בידור', 'ספורט', 'תרבות'] },
  { cat: 'health', words: ['רפואה', 'בריאות', 'פארמה'] },
  { cat: 'car', words: ['רכב', 'דלק'] },
  { cat: 'transport', words: ['תחבורה', 'נסיעות ציבוריות'] },
  { cat: 'insurance', words: ['ביטוח'] },
  { cat: 'clothing', words: ['אופנה', 'ביגוד', 'הנעלה'] },
  { cat: 'shopping', words: ['אלקטרוניקה', 'חשמל', 'מחשבים', 'קניות', 'צעצועים', 'ספרים', 'משרד'] },
  { cat: 'telecom', words: ['תקשורת', 'סלולר', 'אינטרנט', 'טלפון'] },
  { cat: 'housing', words: ['ריהוט', 'בית', 'עירייה', 'ממשלה', 'שירותי דת', 'דיור', 'תחזוקה'] },
  { cat: 'utilities', words: ['חשמל ומים', 'אנרגיה'] },
  { cat: 'education', words: ['חינוך', 'לימודים'] },
  { cat: 'beauty', words: ['טיפוח', 'יופי', 'קוסמטיקה'] },
  { cat: 'travel', words: ['תיירות', 'טיסות', 'מלונות', 'נופש', 'חופשה'] },
  { cat: 'fees', words: ['בנקים', 'כרטיסי אשראי', 'עמלות', 'פיננסי'] },
  { cat: 'pets', words: ['חיות'] },
  { cat: 'gifts', words: ['תרומות', 'מתנות'] },
];

function matchWord(padded: string, word: string): boolean {
  const w = normalizeMerchant(word);
  if (!w) return false;
  const trailingSpace = word.endsWith(' ');
  const needle = trailingSpace ? ` ${w} ` : w.length <= 3 ? ` ${w} ` : w;
  return padded.includes(needle) || (trailingSpace && padded.endsWith(` ${w} `));
}

function firstMatch(rules: Rule[], norm: string): string | null {
  const padded = ` ${norm} `;
  for (const rule of rules) {
    for (const w of rule.words) if (matchWord(padded, w)) return rule.cat;
  }
  return null;
}

function fromSourceCategory(sourceCategory?: string): string | null {
  if (!sourceCategory) return null;
  const norm = normalizeMerchant(sourceCategory);
  if (!norm) return null;
  for (const rule of SOURCE_CATEGORY_MAP) {
    if (rule.words.some((w) => norm.includes(normalizeMerchant(w)))) return rule.cat;
  }
  return null;
}

export interface CategorizeInput {
  description: string;
  amount: number;
  source: Source;
  sourceCategory?: string;
  /** כללים שנלמדו מהמשתמש: שם בית עסק מנורמל ← קטגוריה */
  userRules?: Record<string, string>;
}

/**
 * סדר עדיפויות: כלל משתמש ← כללי בנק (חיוב אשראי/חיסכון/עמלות) ← בתי עסק מוכרים ←
 * קטגוריית הקובץ (Max) ← ברירת מחדל לפי כיוון הכסף.
 */
export function categorize(input: CategorizeInput): string {
  const norm = normalizeMerchant(input.description);
  const userCat = input.userRules?.[norm];
  if (userCat && getCategory(userCat).id === userCat) return userCat;

  if (input.source === 'bank') {
    const bank = firstMatch(BANK_RULES, norm);
    if (bank) {
      // ריבית/עמלה בכיוון זכות היא זיכוי, לא הוצאה
      if (input.amount > 0 && (bank === 'fees' || bank === 'cash' || bank === 'loans')) return 'refund';
      return bank;
    }
    if (input.amount > 0) {
      const inc = firstMatch(BANK_INCOME_RULES, norm);
      if (inc) return inc;
      return 'income_other';
    }
  }

  const merchant = firstMatch(MERCHANT_RULES, norm);
  if (merchant) return merchant;

  const fromFile = fromSourceCategory(input.sourceCategory);
  if (fromFile) return fromFile;

  if (input.amount > 0) {
    if (input.source === 'card') return 'refund';
    return 'income_other';
  }
  return 'other';
}
