// Design Ref: §8 Test Plan — WeaknessService.
// 핵심: 약점 큐 = leech + 최근 7일 Again + reveal_ms 평균>8초 + scan 미편입.
//       7일 지난 Again 제외, 빠른 reveal 제외. gradeCard 재스케줄/promoted 마킹.

import { describe, expect, it } from 'vitest';
import { InMemoryCardRepo } from '~/db/repos/memory/InMemoryCardRepo';
import { InMemoryReviewLogRepo } from '~/db/repos/memory/InMemoryReviewLogRepo';
import { InMemoryScanResultRepo } from '~/db/repos/memory/InMemoryScanResultRepo';
import { InMemoryUserCardRepo } from '~/db/repos/memory/InMemoryUserCardRepo';
import { FsrsScheduler } from '~/srs/FsrsScheduler';
import type { CardType, JlptLevel, UserCard, Word } from '~/types/Card';
import { Grade } from '~/types/Grade';
import type { ReviewLogRecord } from '~/types/ReviewLog';
import type { ScanResultRecord } from '~/types/ScanResult';
import { WeaknessService } from './WeaknessService';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

function word(id: string, level: JlptLevel = 'N5'): Word {
  return {
    id,
    level,
    surface: id,
    reading_kana: 'かな',
    furigana: null,
    meaning_ko: '뜻',
    part_of_speech: null,
    card_type: 'A' as CardType,
    example_jp: null,
    example_ko: null,
    example_jp_id: null,
    example_jp_author: null,
    example_ko_id: null,
    example_ko_author: null,
    example_license: null,
    alt_forms: null,
    disambig: null,
    source: null,
    qa_status: 'verified',
    deprecated: 0,
    tags: null,
    data_version: 1,
  };
}

function uc(wordId: string, patch: Partial<UserCard> = {}): UserCard {
  return {
    word_id: wordId,
    difficulty: 5,
    stability: 5,
    scheduled_days: 1,
    elapsed_days: 1,
    reps: 3,
    lapses: 0,
    last_review: NOW - DAY,
    due: NOW,
    state: 'review',
    note: null,
    leech: 0,
    ...patch,
  };
}

function log(p: Partial<ReviewLogRecord> & { word_id: string; reviewed_at: number }): ReviewLogRecord {
  return {
    grade: Grade.Again,
    state_before: 'review',
    state_after: 'relearning',
    scheduled_days: 0,
    elapsed_days: 1,
    stability_after: 2,
    difficulty_after: 6,
    reveal_ms: 1000,
    session_id: 1,
    ...p,
  };
}

async function build(opts: {
  words?: Word[];
  userCards?: UserCard[];
  logs?: ReviewLogRecord[];
  scan?: ScanResultRecord[];
}) {
  const cardRepo = new InMemoryCardRepo(opts.words ?? []);
  const userCardRepo = new InMemoryUserCardRepo(opts.userCards ?? []);
  const logRepo = new InMemoryReviewLogRepo();
  for (const l of opts.logs ?? []) await logRepo.insert(l);
  const scanRepo = new InMemoryScanResultRepo();
  for (const s of opts.scan ?? []) await scanRepo.record(s);
  const svc = new WeaknessService(
    logRepo,
    userCardRepo,
    scanRepo,
    cardRepo,
    new FsrsScheduler(),
    () => NOW,
  );
  return { svc, userCardRepo, scanRepo, logRepo };
}

describe('WeaknessService', () => {
  it('includes leech, recent Again, slow reveal, scan-unpromoted', async () => {
    const { svc } = await build({
      words: [word('leech'), word('again'), word('slow'), word('scan')],
      userCards: [uc('leech', { leech: 1 }), uc('again'), uc('slow')],
      logs: [
        log({ word_id: 'again', reviewed_at: NOW - DAY, grade: Grade.Again }),
        log({ word_id: 'slow', reviewed_at: NOW - DAY, grade: Grade.Good, reveal_ms: 9000 }),
      ],
      scan: [
        {
          word_id: 'scan',
          scanned_at: NOW - DAY,
          result: 'unknown',
          batch_size: 50,
          promoted_to_srs: 0,
          session_id: 1,
        },
      ],
    });
    const q = await svc.getWeaknessQueue(['N5'], 50);
    const ids = q.map((c) => c.word.id);
    expect(ids).toContain('leech');
    expect(ids).toContain('again');
    expect(ids).toContain('slow');
    expect(ids).toContain('scan');
    // leech 최우선.
    expect(ids[0]).toBe('leech');
  });

  it('excludes Again older than 7 days and fast reveals', async () => {
    const { svc } = await build({
      words: [word('old'), word('fast')],
      userCards: [uc('old'), uc('fast')],
      logs: [
        log({ word_id: 'old', reviewed_at: NOW - 8 * DAY, grade: Grade.Again }),
        log({ word_id: 'fast', reviewed_at: NOW - DAY, grade: Grade.Good, reveal_ms: 500 }),
      ],
    });
    const q = await svc.getWeaknessQueue(['N5'], 50);
    expect(q).toHaveLength(0);
  });

  it('filters by selected levels', async () => {
    const { svc } = await build({
      words: [word('n5', 'N5'), word('n1', 'N1')],
      userCards: [uc('n5', { leech: 1 }), uc('n1', { leech: 1 })],
    });
    const q = await svc.getWeaknessQueue(['N5'], 50);
    expect(q.map((c) => c.word.id)).toEqual(['n5']);
  });

  it('gradeCard reschedules existing card and writes a log', async () => {
    const { svc, userCardRepo, logRepo } = await build({
      words: [word('again')],
      userCards: [uc('again', { reps: 3 })],
      logs: [log({ word_id: 'again', reviewed_at: NOW - DAY, grade: Grade.Again })],
    });
    const q = await svc.getWeaknessQueue(['N5'], 50);
    await svc.gradeCard(q[0]!, Grade.Good, 3000);
    const after = await userCardRepo.findById('again');
    expect(after?.reps).toBe(4); // 재스케줄됨
    const logs = await logRepo.findAll();
    expect(logs.some((l) => l.word_id === 'again' && l.reveal_ms === 3000)).toBe(true);
  });

  it('gradeCard on scan-only card marks scan promoted (no re-appear)', async () => {
    const { svc, scanRepo } = await build({
      words: [word('scan')],
      scan: [
        {
          word_id: 'scan',
          scanned_at: NOW - DAY,
          result: 'unknown',
          batch_size: 50,
          promoted_to_srs: 0,
          session_id: 1,
        },
      ],
    });
    const q = await svc.getWeaknessQueue(['N5'], 50);
    expect(q[0]?.userCard).toBeNull();
    await svc.gradeCard(q[0]!, Grade.Again, 2000);
    const weak = await scanRepo.findUnpromotedWeak();
    expect(weak).toHaveLength(0);
  });
});
