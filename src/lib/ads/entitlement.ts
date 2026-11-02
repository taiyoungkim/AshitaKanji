// 광고 제거(비소모성 1회 구매) 권한 — expo-iap로 스토어 직접 연동 (서버·외부 서비스 0).
// 원칙: 구매자는 광고 0 + ATT 요청 0. 오프라인에서도 광고가 다시 뜨지 않도록
// 마지막 확인값을 AsyncStorage에 캐시. 모듈 부재 시 "미구매"로 동작 (앱 무영향).
//
// - 진실의 원천: 스토어의 getAvailablePurchases(). 환불되면 목록에서 빠짐 → 다음 실행 때 광고 복귀.
// - Android는 구매를 3일 내 finishTransaction(승인)하지 않으면 자동 환불 → 확인할 때마다 승인.
// - 영수증 서버 검증 없음 (5천원 광고 제거에 위조 리스크 무시 가능).

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { REMOVE_ADS_PRODUCT_ID, ownsRemoveAds } from './adPolicy';

const STORAGE_KEY = 'ashitakanji.noAds';

type Iap = typeof import('expo-iap');
type Purchase = import('expo-iap').Purchase;

// 네이티브 모듈 lazy require — 웹/모듈 미탑재(구 dev client) 환경에서 크래시 방지.
let iapModule: Iap | null | undefined; // undefined = 미시도, null = 사용 불가
function getIap(): Iap | null {
  if (iapModule !== undefined) return iapModule;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    iapModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iapModule = require('expo-iap') as Iap;
  } catch {
    iapModule = null;
  }
  return iapModule;
}

/** UI 구독용 — 설정 화면이 구매 상태를 즉시 반영. */
export const useAdFreeStore = create<{ adFree: boolean }>(() => ({ adFree: false }));

function setAdFree(adFree: boolean): void {
  useAdFreeStore.setState({ adFree });
  void AsyncStorage.setItem(STORAGE_KEY, adFree ? '1' : '0').catch(() => {});
}

export type PurchaseResult = 'purchased' | 'pending' | 'cancelled' | 'unavailable' | 'failed';

// 진행 중인 구매 1건의 결과 — requestPurchase는 결과를 리스너로만 돌려준다.
let settlePurchase: ((result: PurchaseResult) => void) | null = null;

async function finish(iap: Iap, purchase: Purchase): Promise<void> {
  try {
    await iap.finishTransaction({ purchase, isConsumable: false });
  } catch (err) {
    // 다음 확인 때 재시도 — Android 3일 기한 내 여러 번 기회가 있다.
    console.warn('[iap] finishTransaction failed:', err);
  }
}

let connection: Promise<Iap | null> | null = null;

/** 스토어 연결 + 구매 리스너 등록 (1회). 실패 시 다음 호출에서 재시도. */
function connect(): Promise<Iap | null> {
  connection ??= (async () => {
    const iap = getIap();
    if (!iap) return null;
    try {
      await iap.initConnection();
    } catch (err) {
      console.warn('[iap] initConnection failed:', err);
      connection = null;
      return null;
    }
    iap.purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== REMOVE_ADS_PRODUCT_ID) return;
      if (purchase.purchaseState === 'purchased') {
        setAdFree(true);
        void finish(iap, purchase);
        settlePurchase?.('purchased');
      } else if (purchase.purchaseState === 'pending') {
        // Android 지연 결제(편의점 등) — 결제 완료 시 리스너가 다시 호출된다.
        settlePurchase?.('pending');
      }
    });
    iap.purchaseErrorListener((error) => {
      if (error.code === iap.ErrorCode.AlreadyOwned) {
        // 이미 소유 — 상태 동기화로 처리.
        void refresh().then((owned) => settlePurchase?.(owned ? 'purchased' : 'failed'));
        return;
      }
      if (!iap.isUserCancelledError(error)) console.warn('[iap] purchase error:', error);
      settlePurchase?.(iap.isUserCancelledError(error) ? 'cancelled' : 'failed');
    });
    return iap;
  })();
  return connection;
}

/** 스토어 기준으로 소유 여부 재확인 + 미승인 구매 승인. 조회 실패 시 캐시 유지. */
async function refresh(): Promise<boolean> {
  const iap = await connect();
  if (!iap) return isAdFreeNow();
  try {
    const purchases = await iap.getAvailablePurchases();
    for (const p of purchases) {
      if (
        p.productId === REMOVE_ADS_PRODUCT_ID &&
        p.purchaseState === 'purchased' &&
        !('isAcknowledgedAndroid' in p && p.isAcknowledgedAndroid)
      ) {
        await finish(iap, p);
      }
    }
    const owned = ownsRemoveAds(purchases);
    setAdFree(owned);
    return owned;
  } catch (err) {
    console.warn('[iap] getAvailablePurchases failed:', err);
    return isAdFreeNow();
  }
}

let ready: Promise<boolean> | null = null;

/**
 * 광고 제거 구매 여부. 첫 호출에서 캐시 → 스토어 순으로 확인 (이후 메모이즈).
 * 캐시가 "구매"면 스토어를 기다리지 않음 — 환불 반영은 백그라운드 재확인이 처리.
 */
export function isAdFree(): Promise<boolean> {
  ready ??= (async () => {
    const cached = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (cached === '1') {
      useAdFreeStore.setState({ adFree: true });
      void refresh();
      return true;
    }
    return refresh();
  })();
  return ready;
}

/** 현재 상태 동기 조회 — isAdFree()가 한 번 돈 뒤의 값 (이후 구매·환불 반영). */
export function isAdFreeNow(): boolean {
  return useAdFreeStore.getState().adFree;
}

export async function purchaseRemoveAds(): Promise<PurchaseResult> {
  const iap = await connect();
  if (!iap || settlePurchase) return 'unavailable';
  try {
    const products = await iap.fetchProducts({ skus: [REMOVE_ADS_PRODUCT_ID], type: 'in-app' });
    if (!products?.length) return 'unavailable';
    const result = new Promise<PurchaseResult>((resolve) => {
      settlePurchase = (r) => {
        settlePurchase = null;
        resolve(r);
      };
    });
    await iap.requestPurchase({
      request: {
        apple: { sku: REMOVE_ADS_PRODUCT_ID },
        google: { skus: [REMOVE_ADS_PRODUCT_ID] },
      },
      type: 'in-app',
    });
    return await result;
  } catch (err) {
    settlePurchase = null;
    if (iap.isUserCancelledError(err)) return 'cancelled';
    console.warn('[iap] purchase failed:', err);
    return 'failed';
  }
}

/** 구매 복원 — iOS 심사 필수. true = 광고 제거 권한 확인됨. */
export async function restorePurchases(): Promise<boolean | 'unavailable'> {
  const iap = await connect();
  if (!iap) return 'unavailable';
  try {
    await iap.restorePurchases();
  } catch (err) {
    console.warn('[iap] restore failed:', err);
  }
  return refresh();
}
