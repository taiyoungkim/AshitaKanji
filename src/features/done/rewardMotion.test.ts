import { describe, expect, it } from 'vitest';
import {
  countUpValue,
  easeOutCubic,
  planRewardMotion,
  rewardMotionKey,
  REWARD_TIMELINE,
  SPARK_VECTORS,
  totalDurationMs,
} from './rewardMotion';

describe('타임라인', () => {
  it('스펙이 지정한 시작·길이를 그대로 갖는다', () => {
    expect(REWARD_TIMELINE.art).toEqual({ delay: 50, duration: 420 });
    expect(REWARD_TIMELINE.checkBadge).toEqual({ delay: 340, duration: 440 });
    expect(REWARD_TIMELINE.checkStroke).toEqual({ delay: 340, duration: 300 });
    expect(REWARD_TIMELINE.ring).toEqual({ delay: 420, duration: 700 });
    expect(REWARD_TIMELINE.sparks).toEqual({ delay: 420, duration: 500 });
    expect(REWARD_TIMELINE.recipe).toEqual({ delay: 550, duration: 500 });
    expect(REWARD_TIMELINE.progressCell).toEqual({ delay: 700, duration: 600 });
    expect(REWARD_TIMELINE.counts).toEqual({ delay: 700, duration: 550 });
    expect(REWARD_TIMELINE.note).toEqual({ delay: 1150, duration: 400 });
    expect(REWARD_TIMELINE.cta).toEqual({ delay: 1250, duration: 450 });
  });

  it('전체 시퀀스는 약 1.7초에 끝난다', () => {
    expect(totalDurationMs()).toBe(1700);
  });

  it('모든 트랙이 시퀀스 범위 안에 있다', () => {
    const total = totalDurationMs();
    for (const track of Object.values(REWARD_TIMELINE)) {
      expect(track.delay).toBeGreaterThanOrEqual(0);
      expect(track.delay + track.duration).toBeLessThanOrEqual(total);
    }
  });
});

describe('스파크', () => {
  it('정확히 5개다', () => {
    expect(SPARK_VECTORS).toHaveLength(5);
  });

  it('지정된 벡터를 그대로 쓴다', () => {
    expect([...SPARK_VECTORS]).toEqual([
      { x: -34, y: -30 },
      { x: 30, y: -34 },
      { x: -40, y: 14 },
      { x: 38, y: 20 },
      { x: 0, y: -44 },
    ]);
  });
});

describe('easeOutCubic', () => {
  it('0과 1을 고정한다', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('중간에서 감속되어 절반보다 앞서 있다', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
  });

  it('범위 밖 입력을 잘라낸다', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe('countUpValue', () => {
  it('시작은 0, 끝은 목표값이다', () => {
    expect(countUpValue(12, 0)).toBe(0);
    expect(countUpValue(12, 1)).toBe(12);
  });

  it('중간값은 정수로 떨어진다', () => {
    expect(Number.isInteger(countUpValue(30, 0.37))).toBe(true);
  });

  it('목표가 0이면 항상 0이다', () => {
    expect(countUpValue(0, 0.5)).toBe(0);
  });
});

describe('planRewardMotion', () => {
  it('보상이 있으면 라임 연출을 켜고 방금 채운 칸을 지목한다', () => {
    expect(planRewardMotion({ hasReward: true, ingredientCount: 3, reducedMotion: false })).toEqual({
      celebrate: true,
      justFilledIndex: 2,
      instant: false,
    });
  });

  it('보상이 없으면 라임 연출을 끄고 지목할 칸도 없다', () => {
    expect(planRewardMotion({ hasReward: false, ingredientCount: 2, reducedMotion: false })).toEqual(
      { celebrate: false, justFilledIndex: -1, instant: false },
    );
  });

  it('모션 감소면 보상이 있어도 즉시 최종 상태로 둔다', () => {
    expect(planRewardMotion({ hasReward: true, ingredientCount: 1, reducedMotion: true })).toEqual({
      celebrate: false,
      justFilledIndex: 0,
      instant: true,
    });
  });
});

describe('rewardMotionKey', () => {
  it('세션·재료·순번이 같으면 같은 키를 준다', () => {
    const a = rewardMotionKey({ sessionId: 7, itemId: 'onigiri-001', ingredientIndex: 2 });
    const b = rewardMotionKey({ sessionId: 7, itemId: 'onigiri-001', ingredientIndex: 2 });
    expect(a).toBe(b);
  });

  it('순번이 달라지면 키가 달라진다', () => {
    const a = rewardMotionKey({ sessionId: 7, itemId: 'onigiri-001', ingredientIndex: 2 });
    const b = rewardMotionKey({ sessionId: 7, itemId: 'onigiri-001', ingredientIndex: 3 });
    expect(a).not.toBe(b);
  });

  it('값이 없어도 안정적인 키를 만든다', () => {
    expect(rewardMotionKey({ sessionId: null, itemId: null, ingredientIndex: null })).toBe(
      'none:none:-1',
    );
  });
});
