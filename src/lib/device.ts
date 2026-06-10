// 테블릿 판별 — 한자 따라쓰기 등 테블릿 전용 기능 게이트.
// iOS는 Platform.isPad(앱이 supportsTablet 켜진 경우 정확), 그 외는 최단변 dp 기준.
// Material/RN 관례상 sw600dp 이상을 테블릿으로 본다.

import { Platform, useWindowDimensions } from 'react-native';

export const TABLET_MIN_SHORTEST_DP = 600;

/** 화면 가로/세로(dp)로 테블릿 여부 판정. 순수 함수 — 테스트 가능. */
export function isTabletDimensions(width: number, height: number): boolean {
  if (Platform.OS === 'ios' && Platform.isPad) return true;
  const shortest = Math.min(width, height);
  return shortest >= TABLET_MIN_SHORTEST_DP;
}

/** 회전에 반응하는 테블릿 여부 훅. */
export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  return isTabletDimensions(width, height);
}
