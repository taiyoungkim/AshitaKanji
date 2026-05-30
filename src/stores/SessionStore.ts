// Design Ref: §6.1 SessionStore (실행 중 세션만, 메모리) + §5.2 reveal UX.
// Plan SC: reveal 강제 (한자 면 → 탭 → 읽기/뜻). reveal_ms = 카드 노출~첫 reveal 탭.
//
// SessionEngine(오케스트레이션)을 감싼 얇은 reactive 레이어.
// 큐/FSRS/persistence 는 Engine 소관, Store 는 UI 상태(reveal, 현재 카드)만 관리.

import { create } from 'zustand';
import type { CardWithProgress } from '~/types/Card';
import type { Grade } from '~/types/Grade';
import type {
  SessionConfig,
  SessionState,
  SessionSummary,
} from '~/types/Session';
import type { SessionEngine } from '~/features/study/SessionEngine';
import { buildSessionEngine } from '~/features/study/buildSessionEngine';
import { getWordCount } from '~/db/open';

interface SessionStoreState {
  engine: SessionEngine | null;
  current: SessionState | null;     // Engine snapshot (phase/queues/counters)
  card: CardWithProgress | null;    // 현재 카드
  reveal: boolean;                  // 현재 카드 reveal 여부
  cardShownMs: number;              // 현재 카드 노출 시각 (reveal_ms 계산용)
  lastRevealMs: number | null;      // 직전 reveal 까지 걸린 ms (없으면 null)
  summary: SessionSummary | null;   // 세션 종료 요약
  busy: boolean;                    // 비동기 처리 중 (버튼 중복 방지)
  dataEmpty: boolean;               // word 테이블 0행 (데이터 미탑재 — 빌드 필요)

  startSession: (config: SessionConfig) => Promise<void>;
  showReveal: () => void;
  submitGrade: (grade: Grade) => Promise<void>;
  endSession: (reason?: 'completed' | 'abandoned') => Promise<SessionSummary>;
  /** 화면 이탈 등 비정상 종료: 미완 세션을 abandoned 로 기록 후 정리. */
  abandon: () => Promise<void>;
  reset: () => void;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  engine: null,
  current: null,
  card: null,
  reveal: false,
  cardShownMs: 0,
  lastRevealMs: null,
  summary: null,
  busy: false,
  dataEmpty: false,

  async startSession(config) {
    set({ busy: true });
    const engine = await buildSessionEngine();
    const state = await engine.start(config, Date.now());
    set({
      engine,
      current: state,
      card: engine.current(),
      reveal: false,
      cardShownMs: Date.now(),
      lastRevealMs: null,
      summary: null,
      busy: false,
      dataEmpty: getWordCount() === 0,
    });
  },

  showReveal() {
    const { reveal, cardShownMs } = get();
    if (reveal) return;
    set({ reveal: true, lastRevealMs: Math.max(0, Date.now() - cardShownMs) });
  },

  async submitGrade(grade) {
    const { engine, reveal, lastRevealMs, busy } = get();
    if (!engine || busy) return;
    set({ busy: true });

    const now = Date.now();
    await engine.submitGrade(grade, reveal ? lastRevealMs : null, now);

    // 라운드 소진 → Main 끝이면 Again 미니라운드 진입.
    if (engine.isRoundComplete() && engine.snapshot().phase === 'main') {
      await engine.startAgainRound();
    }

    set({
      current: engine.snapshot(),
      card: engine.current(),
      reveal: false,
      cardShownMs: Date.now(),
      lastRevealMs: null,
      busy: false,
    });
  },

  async endSession(reason = 'completed') {
    const { engine } = get();
    if (!engine) throw new Error('no active session');
    const summary = await engine.end(reason, Date.now());
    set({ summary, card: null, current: engine.snapshot() });
    return summary;
  },

  async abandon() {
    const { engine, summary } = get();
    // 이미 정상 종료(summary 존재)했거나 세션이 없으면 기록 불필요.
    if (engine && !summary) {
      try {
        await engine.end('abandoned', Date.now());
      } catch {
        // 종료 기록 실패는 학습 데이터(user_card)에 영향 없음 — 무시.
      }
    }
    get().reset();
  },

  reset() {
    set({
      engine: null,
      current: null,
      card: null,
      reveal: false,
      cardShownMs: 0,
      lastRevealMs: null,
      summary: null,
      busy: false,
      dataEmpty: false,
    });
  },
}));
