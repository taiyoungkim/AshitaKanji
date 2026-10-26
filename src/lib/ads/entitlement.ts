// 광고 제거(비소모성 1회 구매) 권한 — RevenueCat 경유.
// 원칙: 구매자는 광고 0 + ATT 요청 0. 오프라인에서도 광고가 다시 뜨지 않도록
// 마지막 확인값을 AsyncStorage에 캐시. SDK/키 부재 시 "미구매"로 동작 (앱 무영향).
//
// 콘솔 설정 (코드 밖):
// - App Store Connect / Play Console: 비소모성 상품 `remove_ads`
// - RevenueCat: entitlement `no_ads` ← 두 스토어의 `remove_ads` 연결

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'ashitakanji.noAds';
const PRODUCT_ID = 'remove_ads';
const ENTITLEMENT_ID = 'no_ads';

// RevenueCat 공개 SDK 키 (앱 번들에 포함되는 공개값). 비어 있으면 결제 비활성.
const API_KEYS: Partial<Record<typeof Platform.OS, string>> = {
  ios: '',
  android: '',
};

type Rc = typeof import('react-native-purchases');
type CustomerInfo = import('react-native-purchases').CustomerInfo;

// 네이티브 모듈 lazy require — 웹/모듈 미탑재(구 dev client) 환경에서 크래시 방지.
let rcModule: Rc | null | undefined; // undefined = 미시도, null = 사용 불가
function getRc(): Rc | null {
  if (rcModule !== undefined) return rcModule;
  const key = API_KEYS[Platform.OS];
  if (!key) {
    rcModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rc = require('react-native-purchases') as Rc;
    rc.default.configure({ apiKey: key });
    rc.default.addCustomerInfoUpdateListener(applyCustomerInfo);
    rcModule = rc;
  } catch (err) {
    console.warn('[purchases] configure failed:', err);
    rcModule = null;
  }
  return rcModule;
}

/** UI 구독용 — 설정 화면이 구매 상태를 즉시 반영. */
export const useAdFreeStore = create<{ adFree: boolean }>(() => ({ adFree: false }));

function setAdFree(adFree: boolean): void {
  useAdFreeStore.setState({ adFree });
  void AsyncStorage.setItem(STORAGE_KEY, adFree ? '1' : '0').catch(() => {});
}

function applyCustomerInfo(info: CustomerInfo): boolean {
  const adFree = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  setAdFree(adFree);
  return adFree;
}

let ready: Promise<boolean> | null = null;

/**
 * 광고 제거 구매 여부. 첫 호출에서 캐시 → 스토어 순으로 확인 (이후 메모이즈).
 * 캐시가 "구매"면 네트워크를 기다리지 않음 — 환불은 리스너가 나중에 반영.
 */
export function isAdFree(): Promise<boolean> {
  ready ??= (async () => {
    const cached = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (cached === '1') useAdFreeStore.setState({ adFree: true });
    const rc = getRc();
    if (!rc) return cached === '1';
    if (cached === '1') {
      void rc.default.getCustomerInfo().then(applyCustomerInfo).catch(() => {});
      return true;
    }
    try {
      return applyCustomerInfo(await rc.default.getCustomerInfo());
    } catch {
      return false;
    }
  })();
  return ready;
}

/** 현재 상태 동기 조회 — 이미 isAdFree()가 한 번 돈 뒤의 값. */
export function isAdFreeNow(): boolean {
  return useAdFreeStore.getState().adFree;
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'unavailable' | 'failed';

export async function purchaseRemoveAds(): Promise<PurchaseResult> {
  const rc = getRc();
  if (!rc) return 'unavailable';
  try {
    const [product] = await rc.default.getProducts(
      [PRODUCT_ID],
      rc.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    );
    if (!product) return 'unavailable';
    const { customerInfo } = await rc.default.purchaseStoreProduct(product);
    return applyCustomerInfo(customerInfo) ? 'purchased' : 'failed';
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    console.warn('[purchases] purchase failed:', err);
    return 'failed';
  }
}

/** 구매 복원 — iOS 심사 필수. true = 광고 제거 권한 확인됨. */
export async function restorePurchases(): Promise<boolean | 'unavailable'> {
  const rc = getRc();
  if (!rc) return 'unavailable';
  try {
    return applyCustomerInfo(await rc.default.restorePurchases());
  } catch (err) {
    console.warn('[purchases] restore failed:', err);
    return false;
  }
}
