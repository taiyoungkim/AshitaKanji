// Design Ref: §6.2 SettingsStore — 영속 사용자 설정 (레벨/일일한도/TTS).
// Plan SC: 일일 신규 5-50 + 30 초과 고강도 경고 1회 확인. TTS 켜기/속도.
//
// SessionStore(메모리, 세션 단위) 와 분리: 여기는 디바이스에 영속(persist).
// AsyncStorage 백엔드 — MVP는 학습 데이터를 외부로 전송 0 (전부 로컬).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { JLPT_LEVELS, type JlptLevel } from '~/types/Card';

// 일일 신규 한도 경계 (Plan SC).
export const DAILY_NEW_MIN = 5;
export const DAILY_NEW_MAX = 50;
export const HIGH_INTENSITY_THRESHOLD = 30; // 초과 시 고강도 경고.

// TTS 속도 (expo-speech rate). 0.5~1.0, 기본 0.9 (학습용 약간 느리게).
export const TTS_SPEED_MIN = 0.5;
export const TTS_SPEED_MAX = 1.0;
export const TTS_SPEED_DEFAULT = 0.9;

export const clampDailyNew = (n: number): number =>
  Math.min(DAILY_NEW_MAX, Math.max(DAILY_NEW_MIN, Math.round(n)));

export const clampTtsSpeed = (n: number): number =>
  Math.min(TTS_SPEED_MAX, Math.max(TTS_SPEED_MIN, n));

export const isHighIntensity = (dailyNewLimit: number): boolean =>
  dailyNewLimit > HIGH_INTENSITY_THRESHOLD;

interface SettingsState {
  selectedLevels: JlptLevel[]; // 학습 대상 레벨 (다중, 최소 1).
  dailyNewLimit: number; // 5-50.
  ttsEnabled: boolean;
  ttsSpeed: number; // 0.5-1.0.
  /** 고강도(>30) 경고를 이미 확인했는지 — SessionConfig.highIntensityAcknowledged 로 전달. */
  highIntensityWarned: boolean;
  /** persist 복원 완료 여부 — UI가 stale 기본값으로 세션 시작하는 것 방지. */
  _hydrated: boolean;

  setLevels: (levels: JlptLevel[]) => void;
  toggleLevel: (level: JlptLevel) => void;
  setDailyNewLimit: (n: number) => void;
  setTtsEnabled: (on: boolean) => void;
  setTtsSpeed: (n: number) => void;
  acknowledgeHighIntensity: () => void;
}

const DEFAULTS = {
  selectedLevels: ['N5'] as JlptLevel[],
  dailyNewLimit: 12,
  ttsEnabled: true,
  ttsSpeed: TTS_SPEED_DEFAULT,
  highIntensityWarned: false,
};

// 레벨 배열을 JLPT 표준 순서(N5→N1)로 정렬·중복 제거.
const normalizeLevels = (levels: JlptLevel[]): JlptLevel[] => {
  const set = new Set(levels);
  return JLPT_LEVELS.filter((l) => set.has(l));
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      _hydrated: false,

      setLevels(levels) {
        const next = normalizeLevels(levels);
        // 최소 1개 레벨 보장 — 빈 선택이면 무시(직전 상태 유지).
        if (next.length === 0) return;
        set({ selectedLevels: next });
      },

      toggleLevel(level) {
        const cur = get().selectedLevels;
        const has = cur.includes(level);
        const next = has ? cur.filter((l) => l !== level) : [...cur, level];
        // 마지막 1개는 끌 수 없음 (최소 1 레벨).
        if (next.length === 0) return;
        set({ selectedLevels: normalizeLevels(next) });
      },

      setDailyNewLimit(n) {
        const limit = clampDailyNew(n);
        // 고강도 경계 아래로 내리면 경고 확인 플래그 리셋 (다시 넘으면 재경고).
        const patch: Partial<SettingsState> = { dailyNewLimit: limit };
        if (!isHighIntensity(limit)) patch.highIntensityWarned = false;
        set(patch);
      },

      setTtsEnabled(on) {
        set({ ttsEnabled: on });
      },

      setTtsSpeed(n) {
        set({ ttsSpeed: clampTtsSpeed(n) });
      },

      acknowledgeHighIntensity() {
        set({ highIntensityWarned: true });
      },
    }),
    {
      name: 'ashitakanji.settings',
      storage: createJSONStorage(() => AsyncStorage),
      // _hydrated/액션은 영속 제외 — 값 필드만 저장.
      partialize: (s) => ({
        selectedLevels: s.selectedLevels,
        dailyNewLimit: s.dailyNewLimit,
        ttsEnabled: s.ttsEnabled,
        ttsSpeed: s.ttsSpeed,
        highIntensityWarned: s.highIntensityWarned,
      }),
      onRehydrateStorage: () => (state) => {
        // 복원 직후 정규화 + hydrated 표시.
        if (state) {
          state.selectedLevels = normalizeLevels(state.selectedLevels);
          if (state.selectedLevels.length === 0) state.selectedLevels = ['N5'];
          state.dailyNewLimit = clampDailyNew(state.dailyNewLimit);
          state.ttsSpeed = clampTtsSpeed(state.ttsSpeed);
        }
        useSettingsStore.setState({ _hydrated: true });
      },
    },
  ),
);

/** SessionConfig 로 변환 (StudyScreen 세션 시작용). */
export function settingsToSessionConfig(s: SettingsState): {
  levels: JlptLevel[];
  dailyNewLimit: number;
  highIntensityAcknowledged: boolean;
} {
  return {
    levels: s.selectedLevels,
    dailyNewLimit: s.dailyNewLimit,
    highIntensityAcknowledged: s.highIntensityWarned,
  };
}
