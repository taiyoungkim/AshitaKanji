// Design Ref: §8 Test Plan — ScanService.
// 핵심: 분류 → SRS 편입 추천 (모름 > 헷갈림 우선), 안다는 SRS X, 최대 50,
//       promoteToSrs 가 user_card 생성 + scan_result promoted 마킹 + 중복 미생성.

import { describe, expect, it } from 'vitest';
import { InMemoryCardRepo } from '~/db/repos/memory/InMemoryCardRepo';
import { InMemoryScanResultRepo } from '~/db/repos/memory/InMemoryScanResultRepo';
import { InMemorySessionRepo } from '~/db/repos/memory/InMemorySessionRepo';
import { InMemoryUserCardRepo } from '~/db/repos/memory/InMemoryUserCardRepo';
import { FsrsScheduler } from '~/srs/FsrsScheduler';
import type { CardType, JlptLevel, Word } from '~/types/Card';
import { ScanService, SCAN_RECOMMEND_MAX } from './ScanService';

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

function build(words: Word[], now = 1_700_000_000_000) {
  const cardRepo = new InMemoryCardRepo(words);
  const scanRepo = new InMemoryScanResultRepo();
  const userCardRepo = new InMemoryUserCardRepo();
  const sessionRepo = new InMemorySessionRepo();
  const svc = new ScanService(
    cardRepo,
    scanRepo,
    userCardRepo,
    sessionRepo,
    new FsrsScheduler(),
    () => now,
  );
  return { svc, scanRepo, userCardRepo, sessionRepo };
}

describe('ScanService', () => {
  it('endScan recommends unknown before confused, excludes known/later', async () => {
    const words = [word('a'), word('b'), word('c'), word('d')];
    const { svc } = build(words);
    await svc.startScan(['N5'], 50);
    await svc.submitScanGrade('a', 'known');
    await svc.submitScanGrade('b', 'confused');
    await svc.submitScanGrade('c', 'unknown');
    await svc.submitScanGrade('d', 'later');
    const summary = await svc.endScan();

    expect(summary.knownCount).toBe(1);
    expect(summary.confusedCount).toBe(1);
    expect(summary.unknownCount).toBe(1);
    expect(summary.laterCount).toBe(1);
    // 모름(c) 먼저, 헷갈림(b) 다음. known/later 제외.
    expect(summary.recommendedWordIds).toEqual(['c', 'b']);
  });

  it('caps recommendation at SCAN_RECOMMEND_MAX (50)', async () => {
    const words = Array.from({ length: 60 }, (_, i) => word(`w${i}`));
    const { svc } = build(words);
    await svc.startScan(['N5'], 100);
    for (const w of words) await svc.submitScanGrade(w.id, 'unknown');
    const summary = await svc.endScan();
    expect(summary.unknownCount).toBe(60);
    expect(summary.recommendedWordIds).toHaveLength(SCAN_RECOMMEND_MAX);
  });

  it('promoteToSrs creates user_card + marks promoted, no duplicate for existing', async () => {
    const words = [word('a'), word('b')];
    const { svc, scanRepo, userCardRepo } = build(words);
    await svc.startScan(['N5'], 50);
    await svc.submitScanGrade('a', 'unknown');
    await svc.submitScanGrade('b', 'confused');
    await svc.endScan();

    // 'a' 는 이미 user_card 존재 가정 → 중복 생성/덮어쓰기 X.
    const preexisting = new FsrsScheduler().initNew('a', 1);
    preexisting.reps = 5;
    await userCardRepo.upsert(preexisting);

    await svc.promoteToSrs(['a', 'b']);

    const a = await userCardRepo.findById('a');
    const b = await userCardRepo.findById('b');
    expect(a?.reps).toBe(5); // 기존 보존
    expect(b).not.toBeNull(); // 신규 생성
    expect(b?.state).toBe('new');

    const weak = await scanRepo.findUnpromotedWeak();
    expect(weak).toHaveLength(0); // 둘 다 promoted
  });

  it('records session as scan mode and closes it on endScan', async () => {
    const { svc, sessionRepo } = build([word('a')]);
    const session = await svc.startScan(['N5'], 50);
    await svc.submitScanGrade('a', 'known');
    await svc.endScan();
    const rec = await sessionRepo.findById(session.sessionId);
    expect(rec?.mode).toBe('scan');
    expect(rec?.ended_reason).toBe('completed');
    expect(rec?.planned_scan).toBe(50);
  });
});
