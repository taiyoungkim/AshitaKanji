// 전면광고(Interstitial) 매니저 — 학습 세션 완료 → /done 전환점 전용.
// 원칙: 학습 도중 노출 0 (Duolingo 룰). 로드 실패/캡 미충족/모듈 부재 시
// 무조건 통과(onDone 즉시 호출) — 광고가 학습 흐름을 막는 일 절대 없음.
//
// 사용처:
// - app/_layout.tsx: initAds() — ATT 요청 + SDK 초기화 (1회)
// - StudyScreen: preloadInterstitial() (세션 시작), showInterstitialIfEligible() (완료)

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type AdState,
  initialAdState,
  isEligible,
  recordAdShown,
  recordSessionCompleted,
} from './adPolicy';

const STORAGE_KEY = 'ashitakanji.ads';

const AD_UNIT_IDS: Partial<Record<typeof Platform.OS, string>> = {
  ios: 'ca-app-pub-5196395080470762/2127172716',
  android: 'ca-app-pub-5196395080470762/5993094674',
};

// 네이티브 모듈 lazy require — 웹/모듈 미탑재(구 dev client) 환경에서 크래시 방지.
type Gma = typeof import('react-native-google-mobile-ads');
let gmaModule: Gma | null | undefined; // undefined = 미시도, null = 사용 불가
function getGma(): Gma | null {
  if (gmaModule !== undefined) return gmaModule;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    gmaModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    gmaModule = require('react-native-google-mobile-ads') as Gma;
  } catch {
    gmaModule = null;
  }
  return gmaModule;
}

async function loadState(now: number): Promise<AdState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AdState;
  } catch {
    // 파손 시 초기화.
  }
  const fresh = initialAdState(now);
  void saveState(fresh);
  return fresh;
}

async function saveState(state: AdState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 무시 — 다음 기회에 다시 저장.
  }
}

let initialized = false;

/** SDK 초기화 + iOS ATT 요청. 앱 시작 시 1회 (실패해도 앱 동작 무영향). */
export async function initAds(): Promise<void> {
  if (initialized) return;
  const gma = getGma();
  if (!gma) return;
  try {
    if (Platform.OS === 'ios') {
      // ATT는 광고 SDK 초기화 전에 — 동의 결과가 광고 요청 성격(맞춤/비맞춤)을 결정.
      const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
      await requestTrackingPermissionsAsync();
    }
    await gma.default().initialize();
    initialized = true;
    // 첫 실행 시각 기록 (신규 유저 유예 기준점).
    await loadState(Date.now());
  } catch (err) {
    console.warn('[ads] init failed:', err);
  }
}

type InterstitialAdT = import('react-native-google-mobile-ads').InterstitialAd;
let currentAd: InterstitialAdT | null = null;
let adLoaded = false;

/** 전면광고 미리 로드 — 세션 시작 시 호출. 로드엔 수 초 걸리므로 완료 시점엔 늦음. */
export function preloadInterstitial(): void {
  const gma = getGma();
  const unitId = AD_UNIT_IDS[Platform.OS];
  if (!gma || !unitId || adLoaded) return;
  try {
    const id = __DEV__ ? gma.TestIds.INTERSTITIAL : unitId;
    const ad = gma.InterstitialAd.createForAdRequest(id);
    ad.addAdEventListener(gma.AdEventType.LOADED, () => {
      adLoaded = true;
    });
    ad.addAdEventListener(gma.AdEventType.ERROR, () => {
      adLoaded = false;
      currentAd = null;
    });
    currentAd = ad;
    ad.load();
  } catch (err) {
    console.warn('[ads] preload failed:', err);
    currentAd = null;
    adLoaded = false;
  }
}

/**
 * 세션 완료 시 호출. 빈도 캡 통과 + 로드 완료면 광고 표시 후 onDone,
 * 아니면 즉시 onDone. onDone은 정확히 1회 호출 보장.
 */
export async function showInterstitialIfEligible(onDone: () => void): Promise<void> {
  const now = Date.now();
  let state = recordSessionCompleted(await loadState(now));
  const gma = getGma();

  if (!gma || !adLoaded || !currentAd || !isEligible(state, now)) {
    await saveState(state);
    onDone();
    return;
  }

  state = recordAdShown(state, now);
  await saveState(state);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    currentAd = null;
    adLoaded = false;
    onDone();
  };

  try {
    currentAd.addAdEventListener(gma.AdEventType.CLOSED, finish);
    currentAd.addAdEventListener(gma.AdEventType.ERROR, finish);
    await currentAd.show();
  } catch (err) {
    console.warn('[ads] show failed:', err);
    finish();
  }
}
