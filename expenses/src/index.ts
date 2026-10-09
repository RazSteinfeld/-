// נקודת הכניסה של core.js – כל מה שהממשק (app.js) צריך, תחת window.Core
export * from './types';
export * from './dates';
export * from './format';
export * from './categories';
export { categorize, normalizeMerchant } from './categorize';
export { mergeTransactions } from './importer';
export * from './insights';
export * from './advice';
export * from './backup';
export { parseFile, FriendlyError } from './parsers';
export { ICON_PATHS } from './icons-data';
