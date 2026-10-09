import { useColorScheme } from 'react-native';

export interface Palette {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceHigh: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
  heroGradient: [string, string, string];
  overlay: string;
  tabBar: string;
  shadow: string;
  skeleton: string;
}

export const lightPalette: Palette = {
  scheme: 'light',
  bg: '#F3F4FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EDEFF9',
  surfaceHigh: '#FFFFFF',
  text: '#12142B',
  textSecondary: '#555A78',
  textMuted: '#8A8FAA',
  border: '#E2E5F2',
  primary: '#5645F0',
  primarySoft: '#5645F01A',
  onPrimary: '#FFFFFF',
  positive: '#0E9F68',
  positiveSoft: '#0E9F681A',
  negative: '#E0414F',
  negativeSoft: '#E0414F1A',
  warning: '#D98A06',
  warningSoft: '#F59E0B22',
  heroGradient: ['#4636E0', '#6A45F2', '#9A4DF0'],
  overlay: 'rgba(14, 16, 40, 0.45)',
  tabBar: '#FFFFFF',
  shadow: '#1B1F4B',
  skeleton: '#E4E7F3',
};

export const darkPalette: Palette = {
  scheme: 'dark',
  bg: '#0A0B15',
  surface: '#14162A',
  surfaceAlt: '#1C1F38',
  surfaceHigh: '#1E2140',
  text: '#F2F3FB',
  textSecondary: '#A7ABC8',
  textMuted: '#737895',
  border: '#272A48',
  primary: '#8E80FF',
  primarySoft: '#8E80FF26',
  onPrimary: '#0A0B15',
  positive: '#34D6A2',
  positiveSoft: '#34D6A222',
  negative: '#FF7078',
  negativeSoft: '#FF707822',
  warning: '#FBB63C',
  warningSoft: '#FBB63C22',
  heroGradient: ['#2E25A8', '#4B2FC4', '#6B34BC'],
  overlay: 'rgba(0, 0, 0, 0.6)',
  tabBar: '#14162A',
  shadow: '#000000',
  skeleton: '#1F2240',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const fonts = {
  regular: 'Heebo_400Regular',
  medium: 'Heebo_500Medium',
  semibold: 'Heebo_600SemiBold',
  bold: 'Heebo_700Bold',
  extrabold: 'Heebo_800ExtraBold',
} as const;

export type Variant = 'display' | 'hero' | 'title' | 'headline' | 'body' | 'bodyStrong' | 'caption' | 'captionStrong' | 'micro';

export const typography: Record<Variant, { fontFamily: string; fontSize: number; lineHeight: number }> = {
  hero: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 52 },
  display: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 38 },
  title: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 28 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  captionStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 },
  micro: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 15 },
};

export function shadowFor(p: Palette, level: 1 | 2 | 3 = 1) {
  if (p.scheme === 'dark') return { elevation: 0 };
  const map = {
    1: { opacity: 0.06, radius: 10, y: 3, elevation: 2 },
    2: { opacity: 0.1, radius: 18, y: 8, elevation: 5 },
    3: { opacity: 0.16, radius: 28, y: 14, elevation: 10 },
  } as const;
  const s = map[level];
  return {
    shadowColor: p.shadow,
    shadowOpacity: s.opacity,
    shadowRadius: s.radius,
    shadowOffset: { width: 0, height: s.y },
    elevation: s.elevation,
  };
}

/** צבעים לפי הגדרת המכשיר (בהיר/כהה). */
export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? darkPalette : lightPalette;
}

/** מוסיף שקיפות לצבע hex של 6 ספרות */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}
