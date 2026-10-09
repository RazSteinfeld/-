export type CategoryKind = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  label: string;
  /** שם אייקון מ-MaterialCommunityIcons */
  icon: string;
  color: string;
  kind: CategoryKind;
}

export const CATEGORIES: Category[] = [
  // הוצאות
  { id: 'groceries', label: 'סופר ומכולת', icon: 'cart-outline', color: '#22B07D', kind: 'expense' },
  { id: 'dining', label: 'מסעדות וקפה', icon: 'silverware-fork-knife', color: '#F5793A', kind: 'expense' },
  { id: 'delivery', label: 'משלוחי אוכל', icon: 'moped-outline', color: '#F2A93B', kind: 'expense' },
  { id: 'car', label: 'רכב ודלק', icon: 'car-outline', color: '#3B82F6', kind: 'expense' },
  { id: 'transport', label: 'תחבורה ציבורית', icon: 'bus', color: '#5B8DEF', kind: 'expense' },
  { id: 'housing', label: 'דיור ובית', icon: 'home-outline', color: '#8B5CF6', kind: 'expense' },
  { id: 'utilities', label: 'חשמל, מים וגז', icon: 'flash-outline', color: '#EAB308', kind: 'expense' },
  { id: 'telecom', label: 'תקשורת ואינטרנט', icon: 'wifi', color: '#06B6D4', kind: 'expense' },
  { id: 'subscriptions', label: 'מנויים וסטרימינג', icon: 'television-play', color: '#EC4899', kind: 'expense' },
  { id: 'health', label: 'בריאות', icon: 'heart-pulse', color: '#EF4466', kind: 'expense' },
  { id: 'insurance', label: 'ביטוח', icon: 'shield-check-outline', color: '#64748B', kind: 'expense' },
  { id: 'clothing', label: 'ביגוד והנעלה', icon: 'tshirt-crew-outline', color: '#D946EF', kind: 'expense' },
  { id: 'shopping', label: 'קניות ואלקטרוניקה', icon: 'shopping-outline', color: '#14B8A6', kind: 'expense' },
  { id: 'leisure', label: 'פנאי וספורט', icon: 'ticket-confirmation-outline', color: '#A855F7', kind: 'expense' },
  { id: 'travel', label: 'נסיעות וחופשות', icon: 'airplane', color: '#0EA5E9', kind: 'expense' },
  { id: 'education', label: 'חינוך וילדים', icon: 'school-outline', color: '#84CC16', kind: 'expense' },
  { id: 'beauty', label: 'טיפוח ויופי', icon: 'face-woman-shimmer-outline', color: '#FB7185', kind: 'expense' },
  { id: 'pets', label: 'חיות מחמד', icon: 'paw-outline', color: '#C08457', kind: 'expense' },
  { id: 'gifts', label: 'מתנות ותרומות', icon: 'gift-outline', color: '#F43F5E', kind: 'expense' },
  { id: 'loans', label: 'הלוואות ומשכנתא', icon: 'bank-outline', color: '#475569', kind: 'expense' },
  { id: 'fees', label: 'עמלות וריבית', icon: 'percent-outline', color: '#94A3B8', kind: 'expense' },
  { id: 'cash', label: 'משיכת מזומן', icon: 'cash', color: '#78A55A', kind: 'expense' },
  { id: 'other', label: 'אחר', icon: 'dots-horizontal-circle-outline', color: '#9CA3AF', kind: 'expense' },
  // הכנסות
  { id: 'salary', label: 'משכורת', icon: 'briefcase-outline', color: '#10B981', kind: 'income' },
  { id: 'income_other', label: 'הכנסה אחרת', icon: 'cash-plus', color: '#34D399', kind: 'income' },
  { id: 'refund', label: 'החזרים וזיכויים', icon: 'cash-refund', color: '#2DD4BF', kind: 'income' },
  // העברות – לא נספרות בהכנסות ובהוצאות
  { id: 'cc_payment', label: 'חיוב כרטיס אשראי', icon: 'credit-card-outline', color: '#818CF8', kind: 'transfer' },
  { id: 'savings', label: 'חיסכון והשקעות', icon: 'piggy-bank-outline', color: '#38BDF8', kind: 'transfer' },
  { id: 'transfer', label: 'העברות פנימיות', icon: 'swap-horizontal', color: '#A1A1AA', kind: 'transfer' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): Category {
  return BY_ID.get(id) ?? BY_ID.get('other')!;
}

export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.kind === 'expense');
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.kind === 'income');
export const TRANSFER_CATEGORIES = CATEGORIES.filter((c) => c.kind === 'transfer');
