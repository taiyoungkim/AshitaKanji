// 영수증을 이미지로 굽고, 앨범에 저장하거나 공유한다.
//
// 캡처 스택(react-native-view-shot · expo-media-library)은 실제로 저장/공유를 누를 때만
// 불러온다. 최상단 import 로 두면 이 모듈들이 빠진 네이티브 빌드에서 결과 화면 자체가
// 죽는다 — 부가 기능 하나 때문에 보상 화면을 잃지 않도록 지연 로드한다.
//
// 세 경로 모두 실패해도 흐름을 막지 않는다 — 호출부가 토스트로만 알린다.

import type { RefObject } from 'react';
import type { View } from 'react-native';
import * as Sharing from 'expo-sharing';

type CaptureModule = {
  captureRef: (ref: RefObject<View | null>, opts: Record<string, unknown>) => Promise<string>;
};

type MediaModule = {
  requestPermissionsAsync: (writeOnly?: boolean) => Promise<{ granted: boolean }>;
  saveToLibraryAsync: (uri: string) => Promise<void>;
};

export async function captureReceipt(ref: RefObject<View | null>): Promise<string | null> {
  if (!ref.current) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { captureRef } = require('react-native-view-shot') as CaptureModule;
    return await captureRef(ref, { format: 'png', quality: 1 });
  } catch (err: unknown) {
    console.warn('[receipt] capture failed:', err);
    return null;
  }
}

export async function saveReceiptImage(uri: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const media = require('expo-media-library') as MediaModule;
    // 앨범에 쓰기만 하므로 addOnly 권한이면 충분하다.
    const permission = await media.requestPermissionsAsync(true);
    if (!permission.granted) return false;
    await media.saveToLibraryAsync(uri);
    return true;
  } catch (err: unknown) {
    console.warn('[receipt] save failed:', err);
    return false;
  }
}

export async function shareReceiptImage(uri: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    return true;
  } catch (err: unknown) {
    console.warn('[receipt] image share failed:', err);
    return false;
  }
}
