// Design Ref: §10 TTS — expo-speech 일본어 발음. Plan SC: 단어/예문 음성 듣기.
//
// 정책:
//   - 속도/켜기 여부는 SettingsStore 에서 읽음.
//   - 미지원 기기(일본어 음성 없음)면 조용히 무시 + status 'unsupported' 노출.
//   - 학습 데이터 외부 전송 없음 (on-device TTS).

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { useSettingsStore } from '~/stores/SettingsStore';
import { playWordAudio, stopWordAudio, type AudioKind } from '~/lib/audio/wordAudio';

const JA_LANG = 'ja-JP';

export type TtsStatus = 'idle' | 'speaking' | 'unsupported';

export interface UseTTS {
  speak: (text: string | null | undefined) => void;
  /** 사전 생성 오디오(고품질) 우선 재생, 없으면 expo-speech 폴백. */
  speakAudio: (kind: AudioKind, id: string, fallbackText: string | null | undefined) => void;
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
  const speechRequestRef = useRef(0);
  const speechKeyRef = useRef<string | null>(null);
  enabledRef.current = enabled;
  rateRef.current = rate;

  // 미지원 여부를 사전 판단하지 않는다.
  // getAvailableVoicesAsync 목록에 ja가 없어도 iOS가 실제 발화는 성공하는 기기가 많아,
  // 사전 차단하면 버튼이 disabled 되어 "무반응"으로 보인다.
  // 실제 발화 onError 시에만 unsupported 처리(아래 speak).
  useEffect(() => {
    return () => {
      speechRequestRef.current += 1;
      speechKeyRef.current = null;
      void Speech.stop();
      stopWordAudio();
    };
  }, []);

  const speak = useCallback((text: string | null | undefined) => {
    if (!enabledRef.current || !text) return;
    // 같은 발화가 중지 대기/재생 중이면 큐에 다시 넣지 않는다.
    if (speechKeyRef.current === text) return;

    const request = speechRequestRef.current + 1;
    speechRequestRef.current = request;
    speechKeyRef.current = text;
    stopWordAudio();

    void Speech.stop()
      .catch(() => undefined)
      .then(() => {
        if (speechRequestRef.current !== request || !enabledRef.current) return;
        setStatus('speaking');
        Speech.speak(text, {
          language: JA_LANG,
          rate: rateRef.current,
          onDone: () => {
            if (speechRequestRef.current !== request) return;
            speechKeyRef.current = null;
            setStatus('idle');
          },
          onStopped: () => {
            if (speechRequestRef.current !== request) return;
            speechKeyRef.current = null;
            setStatus('idle');
          },
          onError: () => {
            if (speechRequestRef.current !== request) return;
            speechKeyRef.current = null;
            setStatus('unsupported');
          },
        });
      });
  }, []);

  const speakAudio = useCallback(
    (kind: AudioKind, id: string, fallbackText: string | null | undefined) => {
      if (!enabledRef.current) return;
      const request = speechRequestRef.current + 1;
      speechRequestRef.current = request;
      speechKeyRef.current = null;
      setStatus((current) => (current === 'speaking' ? 'idle' : current));

      // stop() 완료 후 최신 요청 하나만 재생한다. expo-speech는 그렇지 않으면 큐에 추가한다.
      void Speech.stop()
        .catch(() => undefined)
        .then(() => {
          if (speechRequestRef.current !== request || !enabledRef.current) return;
          void playWordAudio(kind, id, rateRef.current).then((ok) => {
            if (speechRequestRef.current !== request) return;
            if (ok) {
              // 번들 오디오 성공이면 시스템 TTS 실패 상태를 푼다. 재생 종료 콜백은 없다.
              setStatus('idle');
              return;
            }
            speak(fallbackText);
          });
        });
    },
    [speak],
  );

  const stop = useCallback(() => {
    speechRequestRef.current += 1;
    speechKeyRef.current = null;
    void Speech.stop();
    stopWordAudio();
    setStatus((s) => (s === 'speaking' ? 'idle' : s));
  }, []);

  return { speak, speakAudio, stop, status, enabled };
}
