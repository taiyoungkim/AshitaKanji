// Design Ref: §4.2 SessionEngine — 세션 큐 + Main + Done
// Plan SC: "오늘 완료" = 오늘 큐를 모두 비움. Again 카드는 FSRS 일정으로 이월.
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
import { RepositoryReviewWriter, type ReviewWriter } from '~/db/repos/ReviewWriter';
import type { FsrsScheduler } from '~/srs/FsrsScheduler';
import { shuffle } from '~/lib/shuffle';
import { selectDailyNewCards } from './selectDailyNewCards';
import { calculateDailyNewAllowance } from './dailyStudyPolicy';
import { selectDueReviewCards } from './selectDueReviewCards';

/** Anki 관례: 누적 lapse 8회 → leech. */
const LEECH_LAPSES = 8;

export class SessionEngine {
  private state: SessionState | null = null;
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
    private readonly reviewWriter: ReviewWriter = new RepositoryReviewWriter(
      userCardRepo,
      reviewLogRepo,
    ),
  ) {}

  /** 세션 시작 → 큐 빌드: overdue(due 오름차순) → 신규 N개. */
  async start(config: SessionConfig, now: number = Date.now()): Promise<SessionState> {
    // 1) 복습 대상 (due <= now)
    const dueCards = await this.userCardRepo.findAllDue(now);
    const dueWords = await this.cardRepo.findByIds(dueCards.map((c) => c.word_id));
    const reviewQueue = selectDueReviewCards(dueCards, dueWords);

    // 2) 신규 후보. 복습 backlog가 커지면 신규를 점진 감축한다.
    // Scan에서 미리 편입된 state=new 카드를 먼저 소진하고 남은 한도만 채운다.
    const newAllowance = calculateDailyNewAllowance(
      config.dailyNewLimit,
      reviewQueue.length,
    );
    const newSelection = await selectDailyNewCards(
      this.cardRepo,
      this.userCardRepo,
      config.levels,
      newAllowance,
      now,
    );
    const newQueue: CardWithProgress[] = [
      ...newSelection.pending,
      ...newSelection.fresh.map((word) => ({
        word,
        userCard: this.fsrs.initNew(word.id, now),
      })),
    ];

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

    this.againCount = 0;
    this.goodEasyCount = 0;
    // FSRS due를 가장 오래 밀린 순서로 먼저 처리한다. 신규만 섞어 표제어 순서
    // 암기를 막고, 중도 종료해도 신규보다 복습이 남는 상황을 최소화한다.
    const mainQueue = [...reviewQueue, ...this.shuffleQueue(newQueue)];
    this.state = {
      sessionId,
      // 빈 큐(복습·신규 모두 0)면 곧장 done — UI가 무한 대기/빈 화면에 갇히지 않게.
      phase: mainQueue.length > 0 ? 'main' : 'done',
      mainQueue,
      currentIndex: 0,
      doneNew: 0,
      doneReview: 0,
      startedAtMs: now,
    };
    return this.snapshot();
  }

  /** 현재 카드 (없으면 null = 라운드 소진). */
  current(): CardWithProgress | null {
    const s = this.state;
    if (!s) return null;
    return s.mainQueue[s.currentIndex] ?? null;
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

    // leech 상태까지 같은 user_card + review_log 트랜잭션에 포함한다.
    if (next.lapses >= LEECH_LAPSES) next.leech = 1;
    await this.reviewWriter.save(next, log);

    // 카운터
    if (grade === G.Again) this.againCount += 1;
    if (grade === G.Good || grade === G.Easy) this.goodEasyCount += 1;
    if (wasNew) s.doneNew += 1;
    else s.doneReview += 1;

    s.currentIndex += 1;
  }

  /** 계획된 큐 소진 → 세션 완료. Again 카드는 다음 FSRS due 일정으로 둔다. */
  completeCurrentRound(): void {
    const s = this.state;
    if (!s) throw new Error('session not started');
    if (!this.isRoundComplete()) throw new Error('current round is not complete');
    s.phase = 'done';
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
    };
  }
}
