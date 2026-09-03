// 화면 안전 영역 훅 — 계산 규칙은 ~/lib/screenInsets (순수 함수, 테스트 대상).
//
// 풀스크린 모달(학습/회독/완료)과 시트 모달(단어 상세)에서 inset 이 0 으로
// 내려오는 안드로이드/iOS 케이스를 여기서 한 번에 보정한다.

import { Platform, StatusBar } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  resolveBottomInset,
  resolveFullScreenTopInset,
  resolveSheetTopInset,
  type InsetSources,
} from '~/lib/screenInsets';

export interface ScreenInsets {
  top: number;
  bottom: number;
}

function useInsetSources(): InsetSources & { insetBottom: number } {
  const insets = useSafeAreaInsets();
  return {
    insetTop: insets.top,
    insetBottom: insets.bottom,
    metricsTop: initialWindowMetrics?.insets.top ?? 0,
    statusBarHeight: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
    isAndroid: Platform.OS === 'android',
  };
}

/** 헤더 없는 풀스크린 화면용 — 상·하단 여백을 직접 준다. */
export function useFullScreenInsets(): ScreenInsets {
  const sources = useInsetSources();
  return {
    top: resolveFullScreenTopInset(sources),
    bottom: resolveBottomInset(sources.insetBottom, initialWindowMetrics?.insets.bottom ?? 0),
  };
}

/** 단어 상세 같은 시트 모달용 상단 여백. */
export function useSheetTopInset(): number {
  return resolveSheetTopInset(useInsetSources());
}

/** 네이티브 헤더가 상단을 맡는 화면 — 하단만 보정하면 된다. */
export function useBottomInset(): number {
  const sources = useInsetSources();
  return resolveBottomInset(sources.insetBottom, initialWindowMetrics?.insets.bottom ?? 0);
}
