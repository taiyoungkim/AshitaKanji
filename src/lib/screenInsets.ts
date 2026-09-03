// 화면 안전 영역 계산 — 상단바(상태바/노치)에 콘텐츠가 가리는 것을 막는다.
//
// 왜 useSafeAreaInsets() 하나로 끝나지 않나:
//  - native-stack 의 modal/fullScreenModal 은 안드로이드 edge-to-edge 에서
//    top inset 을 0 으로 돌려주는 기기가 있다 (모달 윈도우에 inset 미전달).
//  - iOS fullScreenModal 에서도 0 이 오는 경우가 있어 실기 metrics 로 보강한다.
// 그래서 "가장 큰 값"을 쓴다 — 남는 여백은 눈에 거슬리는 정도지만,
// 모자란 여백은 닫기 버튼이 시계·상태 아이콘에 깔려 못 누르는 버그가 된다.

export interface InsetSources {
  /** useSafeAreaInsets() 값. */
  insetTop: number;
  /** initialWindowMetrics — 앱 시작 시 캡처된 실기 inset. */
  metricsTop: number;
  /** RN StatusBar.currentHeight (안드로이드 전용, 그 외 0). */
  statusBarHeight: number;
  isAndroid: boolean;
}

/** 풀스크린 화면(학습/회독/완료)용 상단 여백. */
export function resolveFullScreenTopInset({
  insetTop,
  metricsTop,
  statusBarHeight,
  isAndroid,
}: InsetSources): number {
  return Math.max(insetTop, metricsTop, isAndroid ? statusBarHeight : 0, 0);
}

/**
 * 시트 모달(단어 상세)용 상단 여백.
 * iOS page modal 은 네이티브 시트가 이미 상단 여백을 주므로 0 이다.
 */
export function resolveSheetTopInset(sources: InsetSources): number {
  if (!sources.isAndroid) return 0;
  return resolveFullScreenTopInset(sources);
}

/** 하단(홈 인디케이터/제스처 바) 여백 — 모달에서 0 이 오는 경우 metrics 로 보강. */
export function resolveBottomInset(insetBottom: number, metricsBottom: number): number {
  return Math.max(insetBottom, metricsBottom, 0);
}
