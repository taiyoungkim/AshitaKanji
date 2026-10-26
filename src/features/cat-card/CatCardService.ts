// 고양이 카드 — 도장 상태 / 뽑기 / 도감. Design Ref: cat-card-reward §1 D1–D4, §2
//
// available = earned − 뽑기 횟수 × STAMPS_PER_DRAW. 카운터를 저장하지 않으므로
// 세션 기록과 뽑기 기록만 맞으면 도장 수는 항상 맞다.

import type { AppMetaRepo } from '~/db/repos/AppMetaRepo';
import type { CatCardDrawRepo } from '~/db/repos/CatCardDrawRepo';
import type { SessionRepo } from '~/db/repos/SessionRepo';
import { dayKey } from '~/features/stats/StatsRollupService';
import { RARITY_WEIGHTS, SEASON_1, type CatCard, type Rarity } from './catalog';
import { availableDraws, draw, STAMPS_PER_DRAW } from './gacha';
import { earnedStamps } from './stamps';

/** 도장 적립 시작일. v8 마이그레이션이 기록한다 (Design §1 D2). */
export const CAT_CARD_EPOCH_KEY = 'cat_card_epoch';

export interface StampState {
  earned: number;
  /** 아직 쓰지 않은 도장. 10을 넘으면 그만큼 뽑기가 쌓여 있다. */
  available: number;
  /** 지금 가능한 뽑기 횟수. */
  draws: number;
  /** 다음 카드까지 남은 도장. 뽑기가 가능하면 0. */
  untilNext: number;
}

export interface DrawOutcome {
  drawId: number;
  card: CatCard;
  duplicate: boolean;
}

export interface CollectionEntry {
  card: CatCard;
  /** 만난 횟수. 0이면 미보유. */
  count: number;
  firstDrawnAt: number | null;
}

export class CatCardService {
  constructor(
    private readonly sessions: SessionRepo,
    private readonly draws: CatCardDrawRepo,
    private readonly meta: AppMetaRepo,
    private readonly catalog: readonly CatCard[] = SEASON_1,
    private readonly weights: Readonly<Record<Rarity, number>> = RARITY_WEIGHTS,
    private readonly random: () => number = Math.random,
  ) {}

  async stampState(nowMs: number): Promise<StampState> {
    const [earned, existing] = await Promise.all([this.earned(nowMs), this.draws.findAll()]);
    const available = Math.max(earned - existing.length * STAMPS_PER_DRAW, 0);
    const draws = availableDraws(available);
    return {
      earned,
      available,
      draws,
      untilNext: draws > 0 ? 0 : STAMPS_PER_DRAW - available,
    };
  }

  /** 도장이 모자라면 null. 카드는 연출보다 먼저 저장된다 (Design §1 D6). */
  async draw(nowMs: number): Promise<DrawOutcome | null> {
    // 뽑기는 세션을 바꾸지 않으므로 earned 는 트랜잭션 밖에서 읽어도 된다.
    const earned = await this.earned(nowMs);
    // 콜백 안에서 대입하므로 TS 가 null 로 좁히지 않게 단언한다.
    let card = null as CatCard | null;

    const inserted = await this.draws.insertWithin((existing) => {
      if (earned - existing.length * STAMPS_PER_DRAW < STAMPS_PER_DRAW) return null;
      const owned = new Set(existing.map((row) => row.card_id));
      const result = draw(this.catalog, this.weights, owned, this.random);
      card = result.card;
      return { card_id: result.card.id, drawn_at: nowMs, duplicate: result.duplicate };
    });

    if (inserted?.id == null || card === null) return null;
    return { drawId: inserted.id, card, duplicate: inserted.duplicate };
  }

  /** 카탈로그 순서 그대로. 카탈로그에 없는 기록은 무시한다 (Design §1 D3). */
  async collection(): Promise<CollectionEntry[]> {
    const stats = new Map<string, { count: number; first: number }>();
    for (const row of await this.draws.findAll()) {
      const cur = stats.get(row.card_id);
      if (cur) {
        cur.count += 1;
        cur.first = Math.min(cur.first, row.drawn_at);
      } else {
        stats.set(row.card_id, { count: 1, first: row.drawn_at });
      }
    }
    return this.catalog.map((card) => {
      const s = stats.get(card.id);
      return { card, count: s?.count ?? 0, firstDrawnAt: s?.first ?? null };
    });
  }

  private async earned(nowMs: number): Promise<number> {
    const [epoch, sessions] = await Promise.all([this.epoch(nowMs), this.sessions.findAll()]);
    return earnedStamps(sessions, epoch);
  }

  /** 마이그레이션이 이미 기록했다. seed 가 v8 이상으로 나와 마이그레이션을 건너뛴 경우만 여기서 쓴다. */
  private async epoch(nowMs: number): Promise<string> {
    const stored = await this.meta.get(CAT_CARD_EPOCH_KEY);
    if (stored) return stored;
    const key = dayKey(nowMs);
    await this.meta.set(CAT_CARD_EPOCH_KEY, key);
    return key;
  }
}
