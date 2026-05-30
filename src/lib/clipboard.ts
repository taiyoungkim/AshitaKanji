// 클립보드 복사 헬퍼. expo-clipboard 래핑 + 빈 문자열 가드.

import * as Clipboard from 'expo-clipboard';

/** 텍스트를 클립보드에 복사. 성공 시 true. 빈 값/실패 시 false. */
export async function copyText(text: string | null | undefined): Promise<boolean> {
  const value = (text ?? '').trim();
  if (!value) return false;
  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch (err) {
    console.warn('[clipboard] copy failed:', err);
    return false;
  }
}
