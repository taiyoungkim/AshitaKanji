// alpha.1 토큰 회귀 — 값이 조용히 흔들리면 대비가 깨진다.
// 색은 디자인이 지정한 정확한 값이어야 하므로 "그럴듯한 값"이 아니라 리터럴로 못 박는다.

import { describe, expect, it } from 'vitest';
import { darkColors, font, grey, lightColors, typography } from './tokens';

describe('grey ramp', () => {
  it('alpha.1 에서 추가된 두 단계를 갖는다', () => {
    expect(grey.g98).toBe('#F7F7F9');
    expect(grey.g70).toBe('#A9A9B2');
  });
});

describe('전경 토큰', () => {
  // 라이트는 브랜드 인상을 위해 흰색(3.56:1, AA 미달)을 감수한 결정이다.
  // 다크는 orange-500 위에서 흰색이 2.80:1 까지 떨어져 잉크를 유지한다.
  it('주황 면 위 글자는 라이트 흰색 · 다크 잉크다', () => {
    expect(lightColors.onPrimary).toBe('#FFFFFF');
    expect(darkColors.onPrimary).toBe('#1D1D21');
  });

  it('잉크 면 위 글자는 모드별로 반전된다', () => {
    expect(lightColors.onInk).toBe('#F7F7F9');
    expect(darkColors.onInk).toBe('#1D1D21');
  });

  it('다크 본문 계열은 램프 값을 그대로 쓴다', () => {
    expect(darkColors.ink).toBe('#F7F7F9');
    expect(darkColors.body).toBe('#A9A9B2');
  });
});

describe('상태색', () => {
  it('라이트는 밝은 면에서 AA 를 넘기는 진한 톤이다', () => {
    expect(lightColors.success).toBe('#15803D');
    expect(lightColors.warning).toBe('#B45309');
    expect(lightColors.danger).toBe('#DC2626');
    expect(lightColors.info).toBe('#2563EB');
  });

  it('다크는 어두운 면에서 AA 를 넘기는 밝은 톤이다', () => {
    expect(darkColors.success).toBe('#22C55E');
    expect(darkColors.warning).toBe('#F59E0B');
    expect(darkColors.danger).toBe('#F87171');
    expect(darkColors.info).toBe('#60A5FA');
  });
});

describe('글꼴', () => {
  it('모든 굵기가 Pretendard JP 패밀리다', () => {
    for (const family of Object.values(font)) {
      expect(family.startsWith('PretendardJP-')).toBe(true);
    }
  });

  it('타이포 토큰도 JP 패밀리만 참조한다', () => {
    for (const token of Object.values(typography)) {
      expect(token.fontFamily.startsWith('PretendardJP-')).toBe(true);
    }
  });
});
