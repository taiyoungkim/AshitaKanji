// Design Ref: §4.4 WeaknessService — 약점 큐 산정 (신규 증가 X).
// Plan SC 큐 소스 (우선순위 순):
//   1) leech=1
//   2) 최근 7일 Again
//   3) reveal_ms 평균 > 8초
//   4) scan_result confused/unknown 인데 SRS 미편입
// gradeCard: 약점 복습 채점 (기존 user_card 재스케줄, scan 출처는 init 후 promoted 마킹).

import type { CardWithProgress, JlptLevel } from '~/types/Card';
import { Grade } from '~/types/Grade';
import type { CardRepo } from '~/db/repos/CardRepo';
import type { ReviewLogRepo } from '~/db/repos/ReviewLogRepo';
import type { ScanResultRepo } from '~/db/repos/ScanResultRepo';
import type { UserCardRepo } from '~/db/repos/UserCardRepo';
import type { FsrsScheduler } from '~/srs/FsrsScheduler';

export const WEAKNESS_RECENT_DAYS = 7;
export const WEAKNESS_SLOW_REVEAL_MS = 8000;
const DAY_MS = 86_400_000;

export class WeaknessService {
  constructor(
    private readonly reviewLogRepo: ReviewLogRepo,
    private readonly userCardRepo: UserCardRepo,
    private readonly scanResultRepo: ScanResultRepo,
    private readonly cardRepo: CardRepo,
    private readonly scheduler: FsrsScheduler,
    private readonly now: () => number = Date.now,
  ) {}

  /** 약점 큐 (우선순위: leech → 최근 Again → 느린 reveal → scan 미편입). */
  async getWeaknessQueue(
    levels: JlptLevel[],
    limit: number,
  ): Promise<CardWithProgress[]> {
    if (levels.length === 0 || limit <= 0) return [];
    const sinceMs = this.now() - WEAKNESS_RECENT_DAYS * DAY_MS;
    const recentLogs = await this.reviewLogRepo.findSince(sinceMs);

    // 우선순위 보존을 위해 Set 삽입 순서 사용.
    const ordered: string[] = [];
    const seen = new Set<string>();
    const add = (id: string) => {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    };

    // 1) leech
    for (const c of await this.userCardRepo.findLeeches()) add(c.word_id);

    // 2) 최근 7일 Again
    for (const l of recentLogs) if (l.grade === Grade.Again) add(l.word_id);

    // 3) reveal_ms 평균 > 8초 (최근 윈도우 기준)
    const reveal = new Map<string, { sum: number; n: number }>();
    for (const l of recentLogs) {
      if (l.reveal_ms == null) continue;
      const e = reveal.get(l.word_id) ?? { sum: 0, n: 0 };
      e.sum += l.reveal_ms;
      e.n += 1;
      reveal.set(l.word_id, e);
    }
    for (const [wid, e] of reveal) {
      if (e.n > 0 && e.sum / e.n > WEAKNESS_SLOW_REVEAL_MS) add(wid);
    }

    // 4) scan confused/unknown 미편입
    for (const r of await this.scanResultRepo.findUnpromotedWeak()) add(r.word_id);

    if (ordered.length === 0) return [];

    // word 해석 + 레벨/유효 필터 + userCard 부착, 우선순위 순서 유지.
    const words = await this.cardRepo.findByIds(ordered);
    const byId = new Map(words.map((w) => [w.id, w]));
    const levelSet = new Set(levels);

    const out: CardWithProgress[] = [];
    for (const id of ordered) {
      if (out.length >= limit) break;
      const w = byId.get(id);
      if (!w || w.deprecated === 1 || !levelSet.has(w.level)) continue;
      const uc = await this.userCardRepo.findById(id);
      out.push({ word: w, userCard: uc });
    }
    return out;
  }

  /** 약점 복습 채점. scan 출처(신규)는 init 후 promoted 마킹해 재등장 방지. */
  async gradeCard(
    card: CardWithProgress,
    grade: Grade,
    revealMs: number | null,
  ): Promise<void> {
    const now = this.now();
    const base = card.userCard ?? this.scheduler.initNew(card.word.id, now);
    const { next, log } = this.scheduler.review(base, grade, now);
    log.reveal_ms = revealMs;
    await this.userCardRepo.upsert(next);
    await this.reviewLogRepo.insert(log);
    if (!card.userCard) {
      await this.scanResultRepo.markPromoted([card.word.id]);
    }
  }
}
