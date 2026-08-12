// 완료 보상 시퀀스의 타임라인 상수와 보간만 담는다.
// 보상·세션 조회를 넣지 않는다 — 화면이 데이터를 주고 여기서는 시간만 계산한다.
//
// 라임은 체크·링·스파크·방금 채워진 진행 셀에만 쓴다. 콘페티나 무한 펄스는 없다.

/** 각 트랙의 시작(ms)과 길이(ms). 표의 값이 곧 계약이다. */
export interface MotionTrack {
  delay: number;
  duration: number;
}

export const REWARD_TIMELINE = {
  /** 재료 아트 — opacity 0→1, scale 0.8→1 (작은 오버슈트) */
  art: { delay: 50, duration: 420 },
  /** 체크 뱃지 — scale 0.3→1.15→1 */
  checkBadge: { delay: 340, duration: 440 },
  /** 체크 선 그리기 */
  checkStroke: { delay: 340, duration: 300 },
  /** 라임 링 — scale 0.7→2.1, opacity 0.55→0, 1회 */
  ring: { delay: 420, duration: 700 },
  /** 스파크 5개 방사 */
  sparks: { delay: 420, duration: 500 },
  /** 레시피 블록 — opacity 0→1, translateY 10→0 */
  recipe: { delay: 550, duration: 500 },
  /** 방금 채워진 진행 셀 — outline→lime→ink */
  progressCell: { delay: 700, duration: 600 },
  /** 진행 수·새 단어 수 카운트업 */
  counts: { delay: 700, duration: 550 },
  /** 안내문 */
  note: { delay: 1150, duration: 400 },
  /** CTA — opacity 0→1, translateY 24→0 */
  cta: { delay: 1250, duration: 450 },
} as const satisfies Record<string, MotionTrack>;

export type RewardTrackName = keyof typeof REWARD_TIMELINE;

/** 스파크는 정확히 5개다. 개수를 늘리면 파티클 연출이 되어 규칙을 벗어난다. */
export const SPARK_VECTORS = [
  { x: -34, y: -30 },
  { x: 30, y: -34 },
  { x: -40, y: 14 },
  { x: 38, y: 20 },
  { x: 0, y: -44 },
] as const;

/** 스파크의 라임 잔상은 250ms 안에 사라진다. */
export const SPARK_FADE_MS = 250;

/** 진행 셀이 라임에서 잉크로 넘어가기 시작하는 지점(0–1). */
export const PROGRESS_CELL_LIME_HOLD = 0.55;

/** 시퀀스가 끝나는 시각. 마지막 트랙의 delay + duration. */
export function totalDurationMs(): number {
  return Object.values(REWARD_TIMELINE).reduce(
    (max, t) => Math.max(max, t.delay + t.duration),
    0,
  );
}

/** 카운트업과 등장에 쓰는 감속 곡선. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

/** 0→target 카운트업의 현재 표시값. 정수로 떨어뜨려 자릿수가 떨리지 않게 한다. */
export function countUpValue(target: number, progress: number): number {
  return Math.round(target * easeOutCubic(progress));
}

/**
 * 보상 유무에 따라 어떤 라임 연출을 켤지 정한다.
 * 보상이 없으면 체크·링·스파크·라임 진행 셀을 아예 렌더하지 않는다.
 */
export interface RewardMotionPlan {
  /** 라임을 쓰는 축하 연출 전체. */
  celebrate: boolean;
  /** 방금 채워진 진행 셀의 인덱스. 없으면 -1. */
  justFilledIndex: number;
  /** true 면 모든 값을 최종 상태로 즉시 둔다. */
  instant: boolean;
}

export function planRewardMotion(input: {
  hasReward: boolean;
  ingredientCount: number;
  reducedMotion: boolean;
}): RewardMotionPlan {
  const { hasReward, ingredientCount, reducedMotion } = input;
  return {
    celebrate: hasReward && !reducedMotion,
    justFilledIndex: hasReward ? ingredientCount - 1 : -1,
    instant: reducedMotion,
  };
}

/**
 * 시퀀스를 다시 재생할지 판단하는 키.
 * 같은 마운트에서 영수증을 열었다 닫아도 이 키가 그대로면 재실행하지 않는다.
 */
export function rewardMotionKey(input: {
  sessionId: number | null;
  itemId: string | null;
  ingredientIndex: number | null;
}): string {
  const { sessionId, itemId, ingredientIndex } = input;
  return `${sessionId ?? 'none'}:${itemId ?? 'none'}:${ingredientIndex ?? -1}`;
}
