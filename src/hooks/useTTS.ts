// Design Ref: §10 TTS — expo-speech 일본어 발음. Plan SC: 단어/예문 음성 듣기.
//
// 정책:
//   - 속도/켜기 여부는 SettingsStore 에서 읽음.
//   - 미지원 기기(일본어 음성 없음)면 조용히 무시 + status 'unsupported' 노출.
//   - 학습 데이터 외부 전송 없음 (on-device TTS).

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { useSettingsStore } from '~/stores/SettingsStore';

const JA_LANG = 'ja-JP';

export type TtsStatus = 'idle' | 'speaking' | 'unsupported';

export interface UseTTS {
  speak: (text: string | null | undefined) => void;
  stop: () => void;
  status: TtsStatus;
  enabled: boolean;
}

export function useTTS(): UseTTS {
  const enabled = useSettingsStore((s) => s.ttsEnabled);
  const rate = useSettingsStore((s) => s.ttsSpeed);
  const [status, setStatus] = useState<TtsStatus>('idle');
  // 마운트 동안 콜백에서 최신 값 참조 (speak는 useCallback 안정화).
  const enabledRef = useRef(enabled);
  const rateRef = useRef(rate);
  enabledRef.current = enabled;
  rateRef.current = rate;

  // 미지원 여부를 사전 판단하지 않는다.
  // getAvailableVoicesAsync 목록에 ja가 없어도 iOS가 실제 발화는 성공하는 기기가 많아,
  // 사전 차단하면 버튼이 disabled 되어 "무반응"으로 보인다.
  // 실제 발화 onError 시에만 unsupported 처리(아래 speak).
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speak = useCallback((text: string | null | undefined) => {
    if (!enabledRef.current || !text) return;
    Speech.stop(); // 직전 발화 중단(중복 방지).
    setStatus('speaking');
    Speech.speak(text, {
      language: JA_LANG,
      rate: rateRef.current,
      onDone: () => setStatus((s) => (s === 'speaking' ? 'idle' : s)),
      onStopped: () => setStatus((s) => (s === 'speaking' ? 'idle' : s)),
      onError: () => setStatus('unsupported'),
    });
  }, []);

  const stop = useCallback(() => {
    Speech.stop();
    setStatus((s) => (s === 'speaking' ? 'idle' : s));
  }, []);

  return { speak, stop, status, enabled };
}
