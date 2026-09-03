// Onikan Design Language — tokens.
// Source of truth: ~/dev/Onikan/DESIGN.md + handoff/README.md
//
// 규칙 요약:
// - 주요 액션은 ink 채움 + onInk 라벨. orange(primary)는 브랜드·상태 강조에만 쓴다.
// - lime(secondary)은 진척·완료 순간에만 쓴다.
// - mute는 잠김·플레이스홀더 전용 — 일반 캡션에 쓰지 않는다.
// - 그라데이션·텍스트 그림자·카드 안 카드 금지. 그림자는 카드 Level 1 하나뿐.
// - 영수증만 radius 4 — "종이" 신호 전용.

import type { TextStyle, ViewStyle } from 'react-native';

// ─── Onikan Grey ramp (hue 228, ~2.6% sat) ───
export const grey = {
  g99: '#FAFAFB',
  g98: '#F7F7F9',
  g97: '#F2F2F4',
  g96: '#EDEDF1',
  g95: '#E8E8EC',
  g90: '#DCDCE2',
  g80: '#C4C4CC',
  g70: '#A9A9B2',
  g60: '#8E8E97',
  g50: '#71717A',
  g40: '#56565E',
  g30: '#3E3E45',
  g22: '#2B2B31',
  g15: '#1D1D21',
  g10: '#131316',
} as const;

export interface ThemeColors {
  ink: string;
  body: string;
  /** 잠김·플레이스홀더 전용 (3.4:1). 일반 캡션 금지. */
  mute: string;
  canvas: string;
  softer: string;
  soft: string;
  pressed: string;
  /** 일러스트 배킹 타일 — 라이트·다크 공통 고정. */
  plate: string;
  shadow: string;
  /** 브랜드·상태 강조 orange. 주요 액션은 ink 를 사용한다. */
  primary: string;
  /** orange 상태 뱃지 배경. 다크에서는 면이 아니라 톤만 남긴다. */
  primarySoft: string;
  /** orange 강조 면의 누름 상태. */
  primaryPressed: string;
  /**
   * 주황 primary 면 위의 글자·아이콘.
   * 라이트는 흰색(3.56:1)으로, 브랜드 인상을 위해 AA 미달을 감수한 선택이다.
   * 다크는 orange-500 위에서 흰색이 2.80:1 까지 떨어져 잉크(5.99:1)를 유지한다.
   */
  onPrimary: string;
  /** ink 면 위의 글자·아이콘. canvas/softer 를 전경색 대용으로 쓰지 않는다. */
  onInk: string;
  /** 활성 탭 틴트 (12px AA 대비 확보용 별도 톤). */
  tabActive: string;
  /** ink 버튼의 누름 상태. */
  inkPressed: string;
  /** 진척·완료 전용 lime. */
  secondary: string;
  /** 완료 뱃지·완료 카드 배경. */
  secondarySoft: string;
  onSecondary: string;
  link: string;
  /** 탐색 맥락 진행바 채움 (결과 화면만 ink 사용). */
  barFill: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

/** today-review / review-hub HTML `--page`. 다크는 softer 를 쓴다. */
export const HTML_FLOW_PAGE = '#F4F2EF';

export const lightColors: ThemeColors = {
  ink: grey.g15,
  body: grey.g40,
  mute: grey.g60,
  canvas: '#FFFFFF',
  softer: grey.g97,
  soft: grey.g95,
  pressed: grey.g90,
  plate: grey.g96,
  shadow: 'rgba(0,0,0,0.05)',
  primary: '#EF5112',
  primarySoft: '#FCE8DE',
  primaryPressed: '#D2460E',
  onPrimary: '#FFFFFF',
  onInk: grey.g98,
  tabActive: '#C2410C',
  inkPressed: grey.g10,
  secondary: '#A3E635',
  secondarySoft: '#EAF6DD',
  onSecondary: grey.g15,
  link: '#C2410C',
  barFill: grey.g50,
  // 상태색은 모드별로 나눈다 — 각 면 위에서 AA 를 넘기는 톤이 다르다.
  success: '#15803D',
  warning: '#B45309',
  danger: '#DC2626',
  info: '#2563EB',
};

export const darkColors: ThemeColors = {
  ink: grey.g98,
  body: grey.g70,
  mute: grey.g50,
  canvas: grey.g15,
  softer: grey.g10,
  soft: grey.g22,
  pressed: grey.g30,
  plate: grey.g96, // 다크에서도 고정 — 검정 선화 일러스트 보호
  shadow: 'rgba(0,0,0,0.4)',
  primary: '#F97316',
  primarySoft: '#3A2216',
  primaryPressed: '#FB923C',
  onPrimary: grey.g15,
  onInk: grey.g15,
  tabActive: '#EA580C',
  inkPressed: '#FFFFFF',
  secondary: '#A3E635',
  secondarySoft: '#26301A',
  onSecondary: grey.g15,
  link: '#F97316',
  barFill: grey.g50,
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#F87171',
  info: '#60A5FA',
};

// ─── Typography — Pretendard 단일 서체, 위계는 크기·굵기로만 ───
// 커스텀 폰트는 weight별 패밀리로 로드한다 (RN에서 fontWeight 합성 회피).
// JP 판을 쓰는 이유: 학습 카드가 일본어 한자를 그리는데 plain 판에는 일본어 자형이 없다.
export const font = {
  regular: 'PretendardJP-Regular',
  medium: 'PretendardJP-Medium',
  semibold: 'PretendardJP-SemiBold',
  bold: 'PretendardJP-Bold',
  extrabold: 'PretendardJP-ExtraBold',
} as const;

interface TextToken extends Pick<TextStyle, 'letterSpacing' | 'textTransform' | 'fontVariant'> {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const typography = {
  /** 화면 제목 36/44 700 */
  screenTitle: { fontFamily: font.bold, fontSize: 36, lineHeight: 44 },
  /** 결과·상세 제목 32/40 700 */
  resultTitle: { fontFamily: font.bold, fontSize: 32, lineHeight: 40 },
  /** 히어로 숫자 52/56 700 tabular */
  hero: { fontFamily: font.bold, fontSize: 52, lineHeight: 56, fontVariant: tabular },
  /** 학습 카드 단어 44/53 700 */
  cardWord: { fontFamily: font.bold, fontSize: 44, lineHeight: 53 },
  /** 뜻 26/34 700 */
  meaning: { fontFamily: font.bold, fontSize: 26, lineHeight: 34 },
  /** 리스트 항목 이름 20/28 600 */
  listTitle: { fontFamily: font.semibold, fontSize: 20, lineHeight: 28 },
  /** CTA·상세 재료 이름 18/24 600 */
  cta: { fontFamily: font.semibold, fontSize: 18, lineHeight: 24 },
  /** 카드 제목 17/24 600 */
  cardTitle: { fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  /** 발음 18/26 500 */
  reading: { fontFamily: font.medium, fontSize: 18, lineHeight: 26 },
  /** 예문 일본어 16/26 500 */
  example: { fontFamily: font.medium, fontSize: 16, lineHeight: 26 },
  /** 본문·캡션 15/22 400 — 본문 최소 15 */
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  /** 본문 강조 15/22 600 */
  bodyStrong: { fontFamily: font.semibold, fontSize: 15, lineHeight: 22 },
  /** 보조 수치 13/18 500 tabular */
  caption: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, fontVariant: tabular },
  /** 보조 수치 강조 13/18 600 tabular */
  captionStrong: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18, fontVariant: tabular },
  /** 오버라인 12/16 500, ls 1.4, uppercase */
  overline: {
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  /** 탭 라벨 12/16, ls -0.1 (활성은 semibold로 오버라이드) */
  tab: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: -0.1 },
  /** 영수증 본문 13/20 400 tabular — 모노 폰트 대체 */
  receipt: { fontFamily: font.regular, fontSize: 13, lineHeight: 20, fontVariant: tabular },
} satisfies Record<string, TextToken>;

// ─── Spacing — 기본 4px 그리드. 그룹 구분은 간격으로 (경계 흐리는 18–20 그룹 간격 금지) ───
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  huge: 40,
} as const;

export const layout = {
  /** 화면 좌우 여백 */
  gutter: 20,
  /** 같은 덩어리 카드 사이 */
  gapTight: 12,
  /** 다른 그룹 사이 */
  gapGroup: 28,
  /** 최소 터치 타깃 */
  touchTarget: 44,
  tabBarItemHeight: 52,
  gradeButtonHeight: 60,
  ctaHeight: 56,
} as const;

export const radius = {
  /** 히어로·표준 카드 */
  card: 24,
  /** 타일 대 (56~88px 썸네일) */
  tile: 18,
  /** 타일 중 (44~48px 썸네일) */
  tileMd: 14,
  /** 타일 소 (kanji tile 등) */
  tileSm: 12,
  /** 모든 인터랙티브 컨트롤 */
  pill: 999,
  /** 영수증 전용 — 다른 어디에도 쓰지 않는다 */
  receipt: 4,
  skeleton: 8,
} as const;

export const border = {
  hairline: 1,
  chip: 1.5,
} as const;

export const motion = {
  durationMs: 200,
  riseInMs: 400,
  popMs: 450,
  popDelayMs: 250,
  limeFadeMs: 1200,
  limeFadeDelayMs: 300,
  dimInMs: 200,
  /** 결과 영수증 확인: fill 완료 뒤 자동 이동. */
  buttonAutoFillMs: 2000,
  /** 온보딩 안내: 시각 진행 표시만 하며 자동 이동하지 않는다. */
  guideFillMs: 2000,
  /** 온보딩 재료 획득: 시각 진행 표시만 하며 자동 이동하지 않는다. */
  studyCompleteFillMs: 1800,
  confettiBurstMs: 2400,
  receiptPrintDelayMs: 60,
  receiptPrintMs: 1350,
} as const;

/**
 * Level 1 — 시스템의 유일한 그림자. 히어로·보상·메뉴 카드와 토스트만.
 * 디자인 정본은 `0 6px 14px shadow` 이고, 여기서 14 는 **CSS blur radius** 다.
 *
 * 옛 `shadowRadius` 는 blur 가 아니라 가우시안 표준편차라 같은 숫자를 넣으면 약 두 배로
 * 퍼진다(피그마보다 훨씬 세게 보였던 원인). Android `elevation` 은 opacity 를 무시하고
 * 자체 그림자를 그려서 0.05 같은 미묘한 값이 사라진다.
 * `boxShadow` 는 CSS 와 같은 의미라 정본 값을 그대로 옮길 수 있다.
 */
export function cardShadow(c: ThemeColors): ViewStyle {
  return { boxShadow: `0px 6px 14px ${c.shadow}` };
}


export function makeButtons(c: ThemeColors) {
  return {
    /** 화면당 단 하나. */
    primary: {
      borderRadius: radius.pill,
      minHeight: layout.ctaHeight,
      paddingHorizontal: spacing.xl,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: c.ink,
    },
    /** surface 필, ink 텍스트. */
    secondary: {
      borderRadius: radius.pill,
      minHeight: layout.touchTarget,
      paddingHorizontal: spacing.xl,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: c.canvas,
    },
    /** soft 필 — 3차·카드 내 액션. */
    subtle: {
      borderRadius: radius.pill,
      minHeight: layout.touchTarget,
      paddingHorizontal: spacing.lg,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: c.soft,
    },
  } as const;
}
