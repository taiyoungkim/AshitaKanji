import { Platform, type TextStyle } from 'react-native';

type FontWeight = NonNullable<TextStyle['fontWeight']>;

interface TextToken {
  fontFamily?: string;
  fontSize: number;
  fontWeight: FontWeight;
  letterSpacing?: number;
  lineHeight: number;
  textTransform?: TextStyle['textTransform'];
}

const monoFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) ?? 'monospace';

export const colors = {
  bg: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F1EF',
  text: '#111111',
  textSecondary: '#777777',
  textTertiary: '#AAAAAA',
  border: '#EAEAEA',
  borderStrong: '#D8D8D8',
  black: '#111111',
  white: '#FFFFFF',
  accent: '#2F2F2F',
} as const;

export const fontFamily = {
  sans: undefined,
  mono: monoFamily,
} satisfies {
  sans: string | undefined;
  mono: string;
};

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
} satisfies Record<string, FontWeight>;

export const typography = {
  display: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: fontWeight.medium,
    letterSpacing: -1.5,
  },
  h1: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.8,
  },
  h2: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: fontWeight.medium,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.regular,
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeight.regular,
  },
  tiny: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: fontWeight.regular,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  receipt: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: fontWeight.regular,
  },
} satisfies Record<string, TextToken>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  huge: 72,
} as const;

export const radius = {
  card: 28,
  pill: 999,
  sketch: 0,
  skeleton: 8,
} as const;

export const border = {
  hairline: 1,
} as const;

export const motion = {
  durationMs: 200,
} as const;

export const layout = {
  screenWidth: 390,
  screenHeight: 844,
  horizontalPadding: spacing.lg,
  tabBarHeight: 72,
} as const;

export const buttons = {
  primary: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 17,
    backgroundColor: colors.black,
    borderColor: 'transparent',
    color: colors.white,
  },
  secondary: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 17,
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
    color: colors.text,
  },
} as const;

export const onigiriTokens = {
  colors,
  fontFamily,
  fontWeight,
  typography,
  spacing,
  radius,
  border,
  motion,
  layout,
  buttons,
} as const;
