// Design Ref: §4.2 SessionEngine — 세션 큐 + Main/Again 미니라운드 + Done
// Plan SC: "오늘 완료" = Main + Again 미니라운드 모두 비움. Again 2회 → 내일로.
//
// 순수 오케스트레이션: Repo 인터페이스 + FsrsScheduler 에만 의존 (DB/UI 무관).

import type { CardWithProgress } from '~/types/Card';
import type { Grade } from '~/types/Grade';
import { Grade as G } from '~/types/Grade';
import type {
  SessionConfig,
  SessionState,
  SessionSummary,
} from '~/types/Session';
import type { CardRepo } from '~/db/repos/CardRepo';
import type { UserCardRepo } from '~/db/repos/UserCardRepo';
import type { ReviewLogRepo } from '~/db/repos/ReviewLogRepo';
import type { SessionRepo } from '~/db/repos/SessionRepo';
import type { FsrsScheduler } from '~/srs/FsrsScheduler';
import { shuffle } from '~/lib/shuffle';

/** Anki 관례: 누적 lapse 8회 → leech. */
const LEECH_LAPSES = 8;
/** Again 미니라운드에서 2회 실패 시 더 반복하지 않고 내일로. */
const AGAIN_DEFER_THRESHOLD = 2;

export class SessionEngine {
  private state: SessionState | null = null;
  /** Main 라운드 중 Again 받은 카드 (Again 라운드 후보). */
  private pendingAgain: CardWithProgress[] = [];
  private againCount = 0;
  private goodEasyCount = 0;

  constructor(
    private readonly cardRepo: CardRepo,
    private readonly userCardRepo: UserCardRepo,
    private readonly reviewLogRepo: ReviewLogRepo,
    private readonly sessionRepo: SessionRepo,
    private readonly fsrs: FsrsScheduler,
    /** 큐 셔플 (기본: Fisher-Yates 랜덤). 테스트는 결정성 위해 항등 함수 주입. */
    private readonly shuffleQueue: <T>(items: readonly T[]) => T[] = shuffle,
  ) {}

  /** 세션 시작 → 큐 빌드: overdue(due 오름차순) → 신규 N개. */
  async start(config: SessionConfig, now: number = Date.now()): Promise<SessionState> {
    // 1) 복습 대상 (due <= now)
    const dueCards = await this.userCardRepo.findAllDue(now);
    const dueWords = await this.cardRepo.findByIds(dueCards.map((c) => c.word_id));
    const wordById = new Map(dueWords.map((w) => [w.id, w]));
    const levelSet = new Set(config.levels);

    const reviewQueue: CardWithProgress[] = [];
    for (const uc of dueCards) {
      const word = wordById.get(uc.word_id);
      if (word && word.deprecated === 0 && levelSet.has(word.level)) {
        reviewQueue.push({ word, userCard: uc });
      }
    }

    // 2) 신규 후보 (user_card 미보유)
    const existing = await this.userCardRepo.existingWordIds();
    const newWords = await this.cardRepo.findNewCandidates(
      config.levels,
      config.dailyNewLimit,
      existing,
    );
    const newQueue: CardWithProgress[] = newWords.map((word) => ({
      word,
      userCard: this.fsrs.initNew(word.id, now),
    }));

    // 3) 세션 레코드 생성
    const sessionId = await this.sessionRepo.create({
      mode: 'review',
      started_at: now,
      ended_at: null,
      ended_reason: null,
      planned_new: newQueue.length,
      planned_review: reviewQueue.length,
      planned_scan: null,
      done_new: 0,
      done_review: 0,
      done_scan: 0,
      again_count: 0,
    });

    this.pendingAgain = [];
    this.againCount = 0;
    this.goodEasyCount = 0;
    // 복습+신규를 합쳐 랜덤 셔플 — 순서 예측(발음 암기) 방지.
    const mainQueue = this.shuffleQueue([...reviewQueue, ...newQueue]);
    this.state = {
      sessionId,
      // 빈 큐(복습·신규 모두 0)면 곧장 done — UI가 무한 대기/빈 화면에 갇히지 않게.
      phase: mainQueue.length > 0 ? 'main' : 'done',
      mainQueue,
      againQueue: [],
      currentIndex: 0,
      doneNew: 0,
      doneReview: 0,
      againSubmissions: new Map(),
      startedAtMs: now,
    };
    return this.snapshot();
  }

  /** 현재 카드 (없으면 null = 라운드 소진). */
  current(): CardWithProgress | null {
    const s = this.state;
    if (!s) return null;
    const queue = s.phase === 'again' ? s.againQueue : s.mainQueue;
    return queue[s.currentIndex] ?? null;
  }

  /** 등급 입력 → FSRS → user_card upsert + review_log + 다음 카드. */
  async submitGrade(
    grade: Grade,
    revealMs: number | null,
    now: number = Date.now(),
  ): Promise<void> {
    const s = this.state;
    if (!s) throw new Error('session not started');
    const cur = this.current();
    if (!cur) throw new Error('no current card');
    if (!cur.userCard) throw new Error('current card has no FSRS state');

    const wasNew = cur.userCard.state === 'new';
    const { next, log } = this.fsrs.review(cur.userCard, grade, now);
    log.reveal_ms = revealMs;
    log.session_id = s.sessionId;

    await this.userCardRepo.upsert(next);
    await this.reviewLogRepo.insert(log);

    // 카운터
    if (grade === G.Again) this.againCount += 1;
    if (grade === G.Good || grade === G.Easy) this.goodEasyCount += 1;
    if (s.phase === 'main') {
      if (wasNew) s.doneNew += 1;
      else s.doneReview += 1;
    }

    // leech 판정
    if (next.lapses >= LEECH_LAPSES && next.leech === 0) {
      await this.userCardRepo.markLeech(next.word_id);
    }

    // Again 처리
    if (grade === G.Again) {
      const prevCnt = s.againSubmissions.get(cur.word.id) ?? 0;
      const cnt = prevCnt + 1;
      s.againSubmissions.set(cur.word.id, cnt);
      const reentry: CardWithProgress = { word: cur.word, userCard: next };
      if (s.phase === 'main') {
        this.pendingAgain.push(reentry); // Again 라운드로 이월
      } else if (cnt < AGAIN_DEFER_THRESHOLD) {
        s.againQueue.push(reentry); // 라운드 내 재시도
      }
      // cnt >= threshold → 재큐 안 함 (내일로, FSRS due 이미 반영)
    }

    s.currentIndex += 1;
  }

  /** Main 라운드 소진 → Again 미니라운드 진입. */
  async startAgainRound(): Promise<void> {
    const s = this.state;
    if (!s) throw new Error('session not started');
    s.againQueue = [...this.pendingAgain];
    this.pendingAgain = [];
    s.currentIndex = 0;
    s.phase = s.againQueue.length > 0 ? 'again' : 'done';
  }

  /** 현재 라운드 카드 모두 소진 여부. */
  isRoundComplete(): boolean {
    return this.current() === null;
  }

  /** 세션 종료 → 요약 + session 레코드 갱신. */
  async end(
    reason: 'completed' | 'abandoned',
    now: number = Date.now(),
  ): Promise<SessionSummary> {
    const s = this.state;
    if (!s) throw new Error('session not started');
    s.phase = 'done';

    await this.sessionRepo.update(s.sessionId, {
      ended_at: now,
      ended_reason: reason,
      done_new: s.doneNew,
      done_review: s.doneReview,
      again_count: this.againCount,
    });

    const summary: SessionSummary = {
      sessionId: s.sessionId,
      durationSec: Math.max(0, Math.round((now - s.startedAtMs) / 1000)),
      newCount: s.doneNew,
      reviewCount: s.doneReview,
      againCount: this.againCount,
      goodEasyCount: this.goodEasyCount,
      streakDays: 0, // module-9 StatsRollupService 에서 산정
    };
    return summary;
  }

  /** 외부 노출용 상태 스냅샷 (방어적 복사). */
  snapshot(): SessionState {
    if (!this.state) throw new Error('session not started');
    return {
      ...this.state,
      mainQueue: [...this.state.mainQueue],
      againQueue: [...this.state.againQueue],
      againSubmissions: new Map(this.state.againSubmissions),
    };
  }
}
