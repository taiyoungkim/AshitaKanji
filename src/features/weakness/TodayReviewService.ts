import type { CardRepo } from '~/db/repos/CardRepo';
import type { ReviewLogRepo } from '~/db/repos/ReviewLogRepo';
import type { SessionRepo } from '~/db/repos/SessionRepo';
import type { UserCardRepo } from '~/db/repos/UserCardRepo';
import type { FsrsScheduler } from '~/srs/FsrsScheduler';
import type { CardWithProgress, JlptLevel } from '~/types/Card';
import { Grade } from '~/types/Grade';
import { RepositoryReviewWriter, type ReviewWriter } from '~/db/repos/ReviewWriter';
import { createSupplementalReviewLog } from './supplementalReview';

export class TodayReviewService {
  constructor(
    private readonly reviewLogs: ReviewLogRepo,
    private readonly userCards: UserCardRepo,
    private readonly cards: CardRepo,
    private readonly sessions: SessionRepo,
    private readonly scheduler: FsrsScheduler,
    private readonly now: () => number = Date.now,
    private readonly reviewWriter: ReviewWriter = new RepositoryReviewWriter(
      userCards,
      reviewLogs,
    ),
  ) {}

  /** 정규 학습 세션에서 `아직이에요`(Again)로 표시한 단어만 원래 순서대로 반환한다. */
  async getQueue(studySessionId: number, levels: readonly JlptLevel[]): Promise<CardWithProgress[]> {
    if (!Number.isInteger(studySessionId) || studySessionId <= 0 || levels.length === 0) return [];
    const logs = await this.reviewLogs.findBySession(studySessionId);
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const log of logs) {
      if (log.grade !== Grade.Again || seen.has(log.word_id)) continue;
      seen.add(log.word_id);
      ids.push(log.word_id);
    }
    if (ids.length === 0) return [];

    const words = await this.cards.findByIds(ids);
    const byId = new Map(words.map((word) => [word.id, word]));
    const levelSet = new Set<JlptLevel>(levels);
    const queue: CardWithProgress[] = [];
    for (const id of ids) {
      const word = byId.get(id);
      if (!word || word.deprecated === 1 || !levelSet.has(word.level)) continue;
      queue.push({ word, userCard: await this.userCards.findById(id) });
    }
    return queue;
  }

  async startSession(studySessionId: number, plannedCount: number): Promise<number> {
    const now = this.now();
    return this.sessions.create({
      mode: 'weakness',
      started_at: now,
      ended_at: null,
      ended_reason: null,
      planned_new: 0,
      planned_review: plannedCount,
      planned_scan: 0,
      done_new: 0,
      done_review: 0,
      done_scan: 0,
      again_count: 0,
      source_session_id: studySessionId,
    });
  }

  async gradeCard(
    card: CardWithProgress,
    grade: Grade,
    revealMs: number | null,
    reviewSessionId: number,
  ): Promise<void> {
    const now = this.now();
    const existing = card.userCard;
    if (existing && existing.due > now) {
      await this.reviewLogs.insert(
        createSupplementalReviewLog(existing, grade, now, revealMs, reviewSessionId),
      );
      return;
    }

    const base = existing ?? this.scheduler.initNew(card.word.id, now);
    const { next, log } = this.scheduler.review(base, grade, now);
    log.reveal_ms = revealMs;
    log.session_id = reviewSessionId;
    await this.reviewWriter.save(next, log);
  }

  async completeSession(reviewSessionId: number, reviewedCount: number): Promise<void> {
    await this.sessions.update(reviewSessionId, {
      ended_at: this.now(),
      ended_reason: 'completed',
      done_review: reviewedCount,
    });
  }

  async abandonSession(reviewSessionId: number, reviewedCount: number): Promise<void> {
    const current = await this.sessions.findById(reviewSessionId);
    if (!current || current.ended_reason !== null) return;
    await this.sessions.update(reviewSessionId, {
      ended_at: this.now(),
      ended_reason: 'abandoned',
      done_review: reviewedCount,
    });
  }
}
