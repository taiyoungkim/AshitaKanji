// Design Ref: §4.1 FsrsScheduler — ts-fsrs wrapper (4단계 등급 → 다음 interval)
// Plan SC: FSRS 4단계 간격반복. 순수 계산 계층 (DB/세션 의존 X).

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type FSRS,
  type FSRSParameters,
  type Grade as FsrsGrade,
} from 'ts-fsrs';
import type { Grade } from '~/types/Grade';
import type { UserCard } from '~/types/Card';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import { toFsrsCard, toUserCard } from './fsrsMap';

// 우리 Grade(1=Again..4=Easy) === ts-fsrs Rating(1..4) 수치 동일.
// FsrsGrade = Rating 중 Manual(0) 제외 → 1-4는 항상 유효.
function toFsrsGrade(grade: Grade): FsrsGrade {
  return grade as unknown as FsrsGrade;
}

export class FsrsScheduler {
  private readonly fsrs: FSRS;

  constructor(params: FSRSParameters = generatorParameters({ enable_fuzz: true })) {
    this.fsrs = fsrs(params);
  }

  /** 신규 카드 초기화 (state='new', due=now). */
  initNew(wordId: string, now: number = Date.now()): UserCard {
    return toUserCard(wordId, createEmptyCard(new Date(now)));
  }

  /**
   * 등급 처리 → 다음 스케줄 + review_log 레코드.
   * reveal_ms / session_id 는 호출자(SessionEngine, module-4)가 채움.
   */
  review(
    card: UserCard,
    grade: Grade,
    now: number = Date.now(),
  ): { next: UserCard; log: ReviewLogRecord } {
    const stateBefore = card.state;
    const { card: nextFsrs } = this.fsrs.next(
      toFsrsCard(card),
      new Date(now),
      toFsrsGrade(grade),
    );
    const next = toUserCard(card.word_id, nextFsrs, card);

    const log: ReviewLogRecord = {
      word_id: card.word_id,
      reviewed_at: now,
      grade,
      state_before: stateBefore,
      state_after: next.state,
      scheduled_days: next.scheduled_days,
      elapsed_days: next.elapsed_days,
      stability_after: next.stability,
      difficulty_after: next.difficulty,
      reveal_ms: null,
      session_id: null,
    };
    return { next, log };
  }

  /** 디버깅용: 동일 카드에 등급 시퀀스를 순차 적용한 예측 카드열. */
  preview(card: UserCard, grades: Grade[], now: number = Date.now()): UserCard[] {
    const out: UserCard[] = [];
    let cur = card;
    let t = now;
    for (const g of grades) {
      const { next } = this.review(cur, g, t);
      out.push(next);
      cur = next;
      t = next.due; // 다음 복습은 due 시점에 했다고 가정
    }
    return out;
  }
}
