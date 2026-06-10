import { describe, expect, it } from 'vitest';
import { strokeToPath, type Pt } from './strokePath';

describe('strokeToPath', () => {
  it('빈 배열은 빈 문자열', () => {
    expect(strokeToPath([])).toBe('');
  });

  it('점 하나는 미세 선분(M..L)으로 캡 렌더', () => {
    expect(strokeToPath([{ x: 10, y: 20 }])).toBe('M 10 20 L 10.1 20');
  });

  it('두 점은 M 으로 시작해 마지막 점까지 L 로 이음', () => {
    const pts: Pt[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    expect(strokeToPath(pts)).toBe('M 0 0 L 10 10');
  });

  it('세 점 이상은 중간점 경유 2차 베지어(Q) 사용', () => {
    const pts: Pt[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
    // i=1: 제어점 (10,0), 중간점 (15,0) → Q 10 0 15 0, 마지막 L 20 0
    expect(strokeToPath(pts)).toBe('M 0 0 Q 10 0 15 0 L 20 0');
  });

  it('좌표는 소수 첫째 자리로 반올림', () => {
    const pts: Pt[] = [{ x: 1.234, y: 5.678 }, { x: 9.999, y: 0.04 }];
    expect(strokeToPath(pts)).toBe('M 1.2 5.7 L 10 0');
  });
});
