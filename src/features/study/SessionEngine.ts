// Design Ref: §4.2 SessionEngine — 세션 큐 + Main + Done
// Plan SC: "오늘 완료" = 오늘 큐를 모두 비움. Again 카드는 FSRS 일정으로 이월.
//
// 2단계 학습 (learning-flow-home-ux):
//   main(1차, FSRS 기록) → interim(중간 결과) → recall(2차 기억 확인) → done.
//   - 1차 큐 소진 시점이 기존 "오늘 완료" 기준이다. 세션 레코드는 이때 completed 로 저장해도 된다.
//   - 2차 기억 확인은 FSRS·review_log 에 쓰지 않는다. 1차 채점으로 due 가 이미 미래이므로
//     기존 보강 복습 정책(scheduling_applied=0, 일정 보존)과 같은 결과이고, 중복 기록을 피한다.
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

/** 2차 기억 확인에 섞는 '한 번 익혔어요' 단어 최대 수. */
export const RECALL_LEARNED_SAMPLE = 5;

export class SessionEngine {
  private state: SessionState | null = null;
  private againCount = 0;
  private goodEasyCount = 0;
  /** 1차 선택 기록(단어 id). 큐에는 같은 단어가 한 번만 들어온다. */
  private againIds: string[] = [];
  private learnedIds: string[] = [];
  /** 같은 세션을 두 번 종료(completed→abandoned 덮어쓰기 등)하지 않도록 캐시. */
  private endedSummary: SessionSummary | null = null;

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
    const reviewQueue = selectDueReviewCards(dueCards, dueWords, config.levels);

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
    this.againIds = [];
    this.learnedIds = [];
    this.endedSummary = null;
    // 복습+신규 전체를 한 번 섞어 고정된 due/표제어 순서로 다음 카드를
    // 예측하지 못하게 한다. 카드 선정과 FSRS 일정 자체는 바꾸지 않는다.
    const mainQueue = this.shuffleQueue([...reviewQueue, ...newQueue]);
    this.state = {
      sessionId,
      // 빈 큐(복습·신규 모두 0)면 곧장 done — UI가 무한 대기/빈 화면에 갇히지 않게.
      phase: mainQueue.length > 0 ? 'main' : 'done',
      mainQueue,
      currentIndex: 0,
      doneNew: 0,
      doneReview: 0,
      startedAtMs: now,
      firstPassAgain: 0,
      firstPassLearned: 0,
      recallQueue: [],
      recallIndex: 0,
      recallRemembered: 0,
      recallConfused: 0,
    };
    return this.snapshot();
  }

  /** 현재 카드 (없으면 null = 라운드 소진). */
  current(): CardWithProgress | null {
    const s = this.state;
    if (!s || s.phase !== 'main') return null;
    return s.mainQueue[s.currentIndex] ?? null;
  }

  /** 2차 기억 확인의 현재 카드 (recall 단계가 아니면 null). */
  currentRecall(): CardWithProgress | null {
    const s = this.state;
    if (!s || s.phase !== 'recall') return null;
    return s.recallQueue[s.recallIndex] ?? null;
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
    if (grade === G.Again) {
      this.againIds.push(cur.word.id);
      s.firstPassAgain += 1;
    } else {
      this.learnedIds.push(cur.word.id);
      s.firstPassLearned += 1;
    }

    s.currentIndex += 1;
  }

  /**
   * 1차 큐 소진 → 중간 결과(interim). 2차 기억 확인 큐를 여기서 **한 번만** 만든다.
   * 큐 = '다시 볼래요' 전체 + '한 번 익혔어요' 중 최대 5개(중복 없음), 한 번 섞어 고정.
   * Again 카드의 FSRS 일정은 그대로 둔다(같은 세션에서 재채점하지 않음).
   */
  completeCurrentRound(): void {
    const s = this.state;
    if (!s) throw new Error('session not started');
    if (!this.isRoundComplete()) throw new Error('current round is not complete');
    if (s.phase !== 'main') return;

    const byId = new Map(s.mainQueue.map((card) => [card.word.id, card]));
    const againSet = new Set(this.againIds);
    const learnedPool = [...new Set(this.learnedIds)].filter((id) => !againSet.has(id));
    const sampled = this.shuffleQueue(learnedPool).slice(0, RECALL_LEARNED_SAMPLE);
    const ids = [...againSet, ...sampled];
    const recallQueue = this.shuffleQueue(
      ids.flatMap((id) => {
        const card = byId.get(id);
        return card ? [card] : [];
      }),
    );

    s.recallQueue = recallQueue;
    s.recallIndex = 0;
    s.phase = recallQueue.length > 0 ? 'interim' : 'done';
  }

  /** 중간 결과 → 2차 기억 확인 시작. */
  startRecall(): void {
    const s = this.state;
    if (!s) throw new Error('session not started');
    if (s.phase !== 'interim') return;
    s.phase = s.recallQueue.length > 0 ? 'recall' : 'done';
  }

  /**
   * 2차 기억 확인 결과. FSRS·review_log 에 쓰지 않는다(1차와 중복 기록 방지).
   * 마지막 카드면 최종 완료(done).
   */
  submitRecall(remembered: boolean): void {
    const s = this.state;
    if (!s) throw new Error('session not started');
    if (s.phase !== 'recall') throw new Error('not in recall phase');
    if (!this.currentRecall()) throw new Error('no current recall card');
    if (remembered) s.recallRemembered += 1;
    else s.recallConfused += 1;
    s.recallIndex += 1;
    if (s.recallIndex >= s.recallQueue.length) s.phase = 'done';
  }

  /** 현재 라운드 카드 모두 소진 여부. */
  isRoundComplete(): boolean {
    const s = this.state;
    if (!s) return false;
    return s.currentIndex >= s.mainQueue.length;
  }

  /** 세션 레코드가 이미 종료 저장되었는지. */
  isEnded(): boolean {
    return this.endedSummary !== null;
  }

  /** 세션 종료 → 요약 + session 레코드 갱신. */
  async end(
    reason: 'completed' | 'abandoned',
    now: number = Date.now(),
  ): Promise<SessionSummary> {
    const s = this.state;
    if (!s) throw new Error('session not started');
    // 이미 저장된 세션은 다시 쓰지 않는다 — 1차 종료 때 completed 로 저장한 뒤
    // 2차 도중 이탈해도 abandoned 로 덮어쓰거나 보상(재료)이 바뀌지 않는다.
    if (this.endedSummary) return this.endedSummary;
    // 1차 도중 종료만 done 으로 닫는다. 중간 결과/기억 확인 중 저장은 단계를 유지한다.
    if (s.phase === 'main') s.phase = 'done';

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
    this.endedSummary = summary;
    return summary;
  }

  /** 외부 노출용 상태 스냅샷 (방어적 복사). */
  snapshot(): SessionState {
    if (!this.state) throw new Error('session not started');
    return {
      ...this.state,
      mainQueue: [...this.state.mainQueue],
      recallQueue: [...this.state.recallQueue],
    };
  }
}
