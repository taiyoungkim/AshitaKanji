// 따라쓰기 캔버스의 점 배열 → SVG path 변환 (순수 함수, 테스트 대상).
// 중간점을 지나는 2차 베지어로 부드럽게 잇는다.

export interface Pt {
  x: number;
  y: number;
}

function r(n: number): number {
  return Math.round(n * 10) / 10;
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** 한 획(점 배열)을 SVG path d 문자열로. 빈 배열은 '' . */
export function strokeToPath(points: Pt[]): string {
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) {
    // 점 하나 — 캡이 보이도록 미세 선분.
    return `M ${r(first.x)} ${r(first.y)} L ${r(first.x + 0.1)} ${r(first.y)}`;
  }
  let d = `M ${r(first.x)} ${r(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i];
    const next = points[i + 1];
    if (!cur || !next) continue;
    const m = mid(cur, next);
    d += ` Q ${r(cur.x)} ${r(cur.y)} ${r(m.x)} ${r(m.y)}`;
  }
  const last = points[points.length - 1];
  if (!last) return d;
  d += ` L ${r(last.x)} ${r(last.y)}`;
  return d;
}
