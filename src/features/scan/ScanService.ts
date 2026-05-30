// Design Ref: §4.3 ScanService — 빠른 훑기 분류 → SRS 편입 추천.
// Plan SC: 50/100/200/300 랜덤(verified), 25개 청크 스트리밍(UI), 분류 4종,
//          편입 추천 = 모름 > 헷갈림 우선, 기본 30 최대 50, 안다는 SRS X.

import type { JlptLevel } from '~/types/Card';
import type { ScanGrade, ScanSession, ScanSummary } from '~/types/ScanResult';
import type { SessionRecord } from '~/types/Session';
import type { CardRepo } from '~/db/repos/CardRepo';
import type { ScanResultRepo } from '~/db/repos/ScanResultRepo';
import type { UserCardRepo } from '~/db/repos/UserCardRepo';
import type { SessionRepo } from '~/db/repos/SessionRepo';
import type { FsrsScheduler } from '~/srs/FsrsScheduler';

/** 편입 기본 추천 수 (화면 사전 선택). */
export const SCAN_RECOMMEND_DEFAULT = 30;
/** 편입 최대 허용 수. */
export const SCAN_RECOMMEND_MAX = 50;

export class ScanService {
  private current: ScanSession | null = null;

  constructor(
    private readonly cardRepo: CardRepo,
    private readonly scanRepo: ScanResultRepo,
    private readonly userCardRepo: UserCardRepo,
    private readonly sessionRepo: SessionRepo,
    private readonly scheduler: FsrsScheduler,
    private readonly now: () => number = Date.now,
  ) {}

  /** 랜덤 추출 + scan 세션 생성. */
  async startScan(
    levels: JlptLevel[],
    batchSize: 50 | 100 | 200 | 300,
  ): Promise<ScanSession> {
    const cards = await this.cardRepo.findScanCandidates(levels, batchSize);
    const rec: SessionRecord = {
      mode: 'scan',
      started_at: this.now(),
      ended_at: null,
      ended_reason: null,
      planned_new: null,
      planned_review: null,
      planned_scan: batchSize,
      done_new: 0,
      done_review: 0,
      done_scan: 0,
      again_count: 0,
    };
    const sessionId = await this.sessionRepo.create(rec);
    this.current = { sessionId, levels, batchSize, cards };
    return this.current;
  }

  /** 분류 저장 (재분류 시 1건 유지). */
  async submitScanGrade(wordId: string, grade: ScanGrade): Promise<void> {
    if (!this.current) throw new Error('ScanService: no active scan session');
    await this.scanRepo.record({
      word_id: wordId,
      scanned_at: this.now(),
      result: grade,
      batch_size: this.current.batchSize,
      promoted_to_srs: 0,
      session_id: this.current.sessionId,
    });
  }

  /** 종료 → SRS 편입 추천 (모름 > 헷갈림, 최대 50). */
  async endScan(): Promise<ScanSummary> {
    if (!this.current) throw new Error('ScanService: no active scan session');
    const sessionId = this.current.sessionId;
    const results = await this.scanRepo.findBySession(sessionId);

    const unknownIds = results.filter((r) => r.result === 'unknown').map((r) => r.word_id);
    const confusedIds = results
      .filter((r) => r.result === 'confused')
      .map((r) => r.word_id);

    const summary: ScanSummary = {
      sessionId,
      total: results.length,
      knownCount: results.filter((r) => r.result === 'known').length,
      confusedCount: confusedIds.length,
      unknownCount: unknownIds.length,
      laterCount: results.filter((r) => r.result === 'later').length,
      // 모름 우선 → 헷갈림, 풀 최대 50개 제공 (화면이 기본 30 사전선택).
      recommendedWordIds: [...unknownIds, ...confusedIds].slice(0, SCAN_RECOMMEND_MAX),
    };

    await this.sessionRepo.update(sessionId, {
      ended_at: this.now(),
      ended_reason: 'completed',
      done_scan: results.length,
    });
    this.current = null;
    return summary;
  }

  /** 선택 word_ids 를 SRS 신규 큐 편입 (기존 user_card 있으면 보존, scan_result 마킹). */
  async promoteToSrs(wordIds: string[]): Promise<void> {
    if (wordIds.length === 0) return;
    const now = this.now();
    for (const id of wordIds) {
      const existing = await this.userCardRepo.findById(id);
      if (!existing) {
        await this.userCardRepo.upsert(this.scheduler.initNew(id, now));
      }
    }
    await this.scanRepo.markPromoted(wordIds);
  }
}
