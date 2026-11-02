// 별점 유도 — 오니기리를 완성한 순간(가장 기분 좋은 때)에만 OS 리뷰 시트를 요청한다.
// OS가 실제 노출을 다시 제한하므로(iOS 연 3회 등) 앱은 요청 간격만 지킨다.
// 리뷰 시트는 별점을 줬는지 알려주지 않는다 → "요청한 시각"만 기록.
// 별점을 요청하는 세션은 광고를 건너뛴다(StudyScreen) — 광고 직후 별점 요청은 낮은 점수로 이어진다.

// react-native 를 import 하지 않는다 — 순수 로직을 vitest 에서 바로 테스트하기 위해.

const STORAGE_KEY = 'ashitakanji.reviewAskedAt';
export const REVIEW_INTERVAL_MS = 120 * 24 * 60 * 60 * 1000; // 재요청 간격 120일

/** 마지막 요청 시각(0 = 없음) 기준으로 지금 요청해도 되는가. */
export function shouldAskReview(lastAskedAt: number, now: number): boolean {
  return lastAskedAt === 0 || now - lastAskedAt >= REVIEW_INTERVAL_MS;
}

// 네이티브 모듈 lazy require — 웹/모듈 미탑재 환경에선 throw → 호출부 catch 에서 무시.
/* eslint-disable @typescript-eslint/no-require-imports */
function modules() {
  return {
    AsyncStorage: (
      require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')
    ).default,
    StoreReview: require('expo-store-review') as typeof import('expo-store-review'),
  };
}
/* eslint-enable @typescript-eslint/no-require-imports */

/** 지금 별점을 요청할 차례인가 (간격 + 스토어 지원). 학습 완료 시 광고를 건너뛸지 판단에 쓴다. */
export async function isReviewDue(): Promise<boolean> {
  try {
    const { AsyncStorage, StoreReview } = modules();
    const last = Number((await AsyncStorage.getItem(STORAGE_KEY)) ?? 0) || 0;
    return shouldAskReview(last, Date.now()) && (await StoreReview.hasAction());
  } catch {
    return false;
  }
}

/** 오니기리 완성 후 호출. 차례면 리뷰 시트를 요청하고 시각을 기록. 실패는 무시. */
export async function maybeAskReview(): Promise<void> {
  try {
    if (!(await isReviewDue())) return;
    const { AsyncStorage, StoreReview } = modules();
    await AsyncStorage.setItem(STORAGE_KEY, String(Date.now()));
    await StoreReview.requestReview();
  } catch (err) {
    console.warn('[review] request failed:', err);
  }
}
