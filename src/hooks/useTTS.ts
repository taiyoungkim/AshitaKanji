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

  // 기기에 일본어 음성이 있는지 1회 확인.
  useEffect(() => {
    let alive = true;
    void Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (!alive) return;
        const hasJa = voices.some((v) => v.language?.toLowerCase().startsWith('ja'));
        // 음성 목록이 비어도(일부 기기 빈 배열) 시스템 기본 ja 폴백이 동작할 수 있어
        // 빈 목록은 unsupported 로 보지 않음. 명시적으로 ja 없음 + 목록 존재일 때만 표시.
        if (!hasJa && voices.length > 0) setStatus('unsupported');
      })
      .catch(() => {
        // 조회 실패는 미지원으로 단정하지 않음 — speak 시도 시 OS가 폴백.
      });
    return () => {
      alive = false;
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
