// Design Ref: §6.1 SessionStore (실행 중 세션만, 메모리) + §5.2 reveal UX.
// Plan SC: reveal 강제 (한자 면 → 탭 → 읽기/뜻). reveal_ms = 카드 노출~첫 reveal 탭.
//
// SessionEngine(오케스트레이션)을 감싼 얇은 reactive 레이어.
// 큐/FSRS/persistence 는 Engine 소관, Store 는 UI 상태(reveal, 현재 카드)와 완료 전환만 관리.

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
  card: CardWithProgress | null;    // 현재 카드 (1차 학습)
  recallCard: CardWithProgress | null; // 현재 카드 (2차 기억 확인)
  reveal: boolean;                  // 현재 카드 reveal 여부
  cardShownMs: number;              // 현재 카드 노출 시각 (reveal_ms 계산용)
  lastRevealMs: number | null;      // 직전 reveal 까지 걸린 ms (없으면 null)
  summary: SessionSummary | null;   // 세션 종료 요약
  busy: boolean;                    // 비동기 처리 중 (버튼 중복 방지)
  dataEmpty: boolean;               // word 테이블 0행 (데이터 미탑재 — 빌드 필요)

  startSession: (config: SessionConfig) => Promise<void>;
  showReveal: () => void;
  submitGrade: (grade: Grade) => Promise<void>;
  /** 중간 결과 → 2차 기억 확인 시작. */
  startRecall: () => void;
  /** 2차 기억 확인 결과 (기억났어요=true / 헷갈렸어요=false). FSRS 미기록. */
  submitRecall: (remembered: boolean) => void;
  endSession: (reason?: 'completed' | 'abandoned') => Promise<SessionSummary>;
  /** 화면 이탈 등 비정상 종료: 미완 세션을 abandoned 로 기록 후 정리. */
  abandon: () => Promise<void>;
  reset: () => void;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  engine: null,
  current: null,
  card: null,
  recallCard: null,
  reveal: false,
  cardShownMs: 0,
  lastRevealMs: null,
  summary: null,
  busy: false,
  dataEmpty: false,

  async startSession(config) {
    const leftover = get();
    // 진행 중 세션은 유지. 완료 후 남은 engine/summary 는 다음 학습을 막지 않는다.
    if (leftover.engine && !leftover.summary) return;
    set({ busy: true });
    try {
      const engine = await buildSessionEngine();
      const state = await engine.start(config, Date.now());
      set({
        engine,
        current: state,
        card: engine.current(),
        recallCard: null,
        reveal: false,
        cardShownMs: Date.now(),
        lastRevealMs: null,
        summary: null,
        dataEmpty: getWordCount() === 0,
      });
    } finally {
      set({ busy: false });
    }
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
    try {
      const now = Date.now();
      await engine.submitGrade(grade, reveal ? lastRevealMs : null, now);

      // 1차 큐 소진 → 중간 결과. Again 카드의 FSRS due 일정은 그대로 둔다.
      // 1차 소진이 기존 "오늘 완료" 기준이므로 세션을 여기서 completed 로 저장한다 —
      // 2차 기억 확인 도중 앱이 종료돼도 학습 기록·재료·도장이 유실되지 않는다.
      // 저장 실패 시 최종 완료 단계(StudyScreen → endSession)에서 다시 시도한다.
      if (engine.isRoundComplete()) {
        engine.completeCurrentRound();
        if (engine.snapshot().phase !== 'done') {
          try {
            await engine.end('completed', Date.now());
          } catch (err) {
            console.warn('[session] first-pass completion save failed:', err);
          }
        }
      }

      set({
        current: engine.snapshot(),
        card: engine.current(),
        recallCard: engine.currentRecall(),
        reveal: false,
        cardShownMs: Date.now(),
        lastRevealMs: null,
      });
    } finally {
      set({ busy: false });
    }
  },

  startRecall() {
    const { engine } = get();
    if (!engine) return;
    engine.startRecall();
    set({
      current: engine.snapshot(),
      recallCard: engine.currentRecall(),
      reveal: false,
      cardShownMs: Date.now(),
      lastRevealMs: null,
    });
  },

  submitRecall(remembered) {
    const { engine, busy } = get();
    if (!engine || busy || !engine.currentRecall()) return;
    engine.submitRecall(remembered);
    set({
      current: engine.snapshot(),
      recallCard: engine.currentRecall(),
      reveal: false,
      cardShownMs: Date.now(),
      lastRevealMs: null,
    });
  },

  async endSession(reason = 'completed') {
    const { engine, summary } = get();
    if (summary) return summary;
    if (!engine) throw new Error('no active session');
    const next = await engine.end(reason, Date.now());
    set({ summary: next, card: null, recallCard: null, current: engine.snapshot() });
    return next;
  },

  async abandon() {
    const { engine, summary, current } = get();
    const reviewed = (current?.doneNew ?? 0) + (current?.doneReview ?? 0);
    // 완료 저장 중이거나 이미 끝난 세션은 버리지 않는다.
    if (summary || (current?.phase === 'done' && reviewed > 0)) return;
    if (engine) {
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
      recallCard: null,
      reveal: false,
      cardShownMs: 0,
      lastRevealMs: null,
      summary: null,
      busy: false,
      dataEmpty: false,
    });
  },
}));
