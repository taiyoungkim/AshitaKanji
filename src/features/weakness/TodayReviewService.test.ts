import { describe, expect, it } from 'vitest';
import { InMemoryCardRepo } from '~/db/repos/memory/InMemoryCardRepo';
import { InMemoryReviewLogRepo } from '~/db/repos/memory/InMemoryReviewLogRepo';
import { InMemorySessionRepo } from '~/db/repos/memory/InMemorySessionRepo';
import { InMemoryUserCardRepo } from '~/db/repos/memory/InMemoryUserCardRepo';
import { FsrsScheduler } from '~/srs/FsrsScheduler';
import type { CardType, JlptLevel, UserCard, Word } from '~/types/Card';
import { Grade } from '~/types/Grade';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import { TodayReviewService } from './TodayReviewService';

const NOW = 1_800_000_000_000;

function word(id: string, level: JlptLevel = 'N5'): Word {
  return {
    id, level, surface: id, reading_kana: 'かな', furigana: null, meaning_ko: '뜻',
    part_of_speech: null, card_type: 'A' as CardType, example_jp: null, example_ko: null,
    example_jp_id: null, example_jp_author: null, example_ko_id: null, example_ko_author: null,
    example_license: null, alt_forms: null, disambig: null, source: null, qa_status: 'verified',
    deprecated: 0, tags: null, data_version: 1,
  };
}

function userCard(id: string): UserCard {
  return {
    word_id: id, difficulty: 5, stability: 3, scheduled_days: 1, elapsed_days: 1,
    reps: 1, lapses: 0, last_review: NOW - 10_000, due: NOW, state: 'review',
    note: null, leech: 0,
  };
}

function log(wordId: string, grade: Grade, sessionId = 10): ReviewLogRecord {
  return {
    word_id: wordId, reviewed_at: NOW - 1_000, grade, state_before: 'review',
    state_after: grade === Grade.Again ? 'relearning' : 'review', scheduled_days: 1,
    elapsed_days: 1, stability_after: 2, difficulty_after: 6, reveal_ms: 500,
    session_id: sessionId,
  };
}

async function build() {
  const cards = new InMemoryCardRepo([word('again-1'), word('good'), word('again-2'), word('n1', 'N1')]);
  const users = new InMemoryUserCardRepo([
    userCard('again-1'), userCard('good'), userCard('again-2'), userCard('n1'),
  ]);
  const logs = new InMemoryReviewLogRepo();
  await logs.insert(log('again-1', Grade.Again));
  await logs.insert(log('good', Grade.Good));
  await logs.insert(log('again-2', Grade.Again));
  await logs.insert(log('again-1', Grade.Again));
  await logs.insert(log('n1', Grade.Again));
  await logs.insert(log('other-session', Grade.Again, 99));
  const sessions = new InMemorySessionRepo();
  const service = new TodayReviewService(logs, users, cards, sessions, new FsrsScheduler(), () => NOW);
  return { service, logs, sessions };
}

describe('TodayReviewService', () => {
  it('returns only unique Again words from the source session in source order', async () => {
    const { service } = await build();
    const queue = await service.getQueue(10, ['N5']);
    expect(queue.map((card) => card.word.id)).toEqual(['again-1', 'again-2']);
  });

  it('filters the queue by selected level', async () => {
    const { service } = await build();
    expect((await service.getQueue(10, ['N1'])).map((card) => card.word.id)).toEqual(['n1']);
  });

  it('records review grades under the dedicated review session', async () => {
    const { service, logs } = await build();
    const queue = await service.getQueue(10, ['N5']);
    const reviewSessionId = await service.startSession(10, queue.length);
    await service.gradeCard(queue[0]!, Grade.Good, 1200, reviewSessionId);
    expect((await logs.findBySession(reviewSessionId))[0]).toMatchObject({ word_id: 'again-1', reveal_ms: 1200 });
  });

  it('completes and abandons review sessions with their processed counts', async () => {
    const { service, sessions } = await build();
    const completedId = await service.startSession(10, 2);
    await service.completeSession(completedId, 2);
    expect(await sessions.findById(completedId)).toMatchObject({ ended_reason: 'completed', done_review: 2 });

    const abandonedId = await service.startSession(10, 3);
    await service.abandonSession(abandonedId, 1);
    expect(await sessions.findById(abandonedId)).toMatchObject({ ended_reason: 'abandoned', done_review: 1 });
  });
});
