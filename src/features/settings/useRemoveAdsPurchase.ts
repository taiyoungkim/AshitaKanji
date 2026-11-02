// 광고 제거 구매 + 결과 토스트 — 설정 화면과 완료 화면 업셀이 함께 쓴다.

import { useState } from 'react';
import { useToast } from '~/components/Toast';
import { purchaseRemoveAds, useAdFreeStore } from '~/lib/ads/entitlement';

export function useRemoveAdsPurchase(): { purchase: () => void; busy: boolean } {
  const toast = useToast();
  const adFree = useAdFreeStore((state) => state.adFree);
  const [busy, setBusy] = useState(false);

  const purchase = () => {
    if (busy || adFree) return;
    setBusy(true);
    void purchaseRemoveAds().then((result) => {
      setBusy(false);
      if (result === 'purchased') toast.show('광고가 제거되었어요. 감사합니다!');
      else if (result === 'pending') toast.show('결제가 완료되면 광고가 제거돼요.');
      else if (result === 'unavailable') toast.show('지금은 구매할 수 없어요. 잠시 후 다시 시도해 주세요.');
      else if (result === 'failed') toast.show('구매를 완료하지 못했어요.');
    });
  };

  return { purchase, busy };
}
