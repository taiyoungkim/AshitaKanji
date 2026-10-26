import { describe, expect, it } from 'vitest';
import { InMemoryAppMetaRepo } from '~/db/repos/memory/InMemoryAppMetaRepo';
import { InMemoryCatCardDrawRepo } from '~/db/repos/memory/InMemoryCatCardDrawRepo';
import { InMemorySessionRepo } from '~/db/repos/memory/InMemorySessionRepo';
import { CAT_CARD_EPOCH_KEY, CatCardService } from './CatCardService';
import { SEASON_1 } from './catalog';

const EPOCH = '2026-10-01';
const NOW = new Date(2027, 5, 1, 12).getTime();

/** EPOCH 부터 n일 연속 완료 세션을 만든 서비스. */
async function setup(days: number, epoch: string | null = EPOCH) {
  const sessions = new InMemorySessionRepo();
  for (let i = 0; i < days; i += 1) {
    const at = new Date(2026, 9, 1 + i, 10).getTime();
    await sessions.create({
      mode: 'new',
      started_at: at,
      ended_at: at,
      ended_reason: 'completed',
      planned_new: null,
      planned_review: null,
      planned_scan: null,
      done_new: 0,
      done_review: 0,
      done_scan: 0,
      again_count: 0,
    });
  }
  const draws = new InMemoryCatCardDrawRepo();
  const meta = new InMemoryAppMetaRepo(epoch ? { [CAT_CARD_EPOCH_KEY]: epoch } : {});
  const service = new CatCardService(sessions, draws, meta, undefined, undefined, () => 0.5);
  return { service, draws, meta };
}

describe('CatCardService', () => {
  it('refuses to draw with 9 stamps', async () => {
    const { service, draws } = await setup(9);
    expect(await service.stampState(NOW)).toEqual({ earned: 9, available: 9, draws: 0, untilNext: 1 });
    expect(await service.draw(NOW)).toBeNull();
    expect(await draws.findAll()).toHaveLength(0);
  });

  it('spends 10 stamps per draw and carries the rest over', async () => {
    const { service } = await setup(25);
    expect((await service.stampState(NOW)).draws).toBe(2);

    expect(await service.draw(NOW)).not.toBeNull();
    expect(await service.draw(NOW)).not.toBeNull();
    expect(await service.draw(NOW)).toBeNull();
    expect(await service.stampState(NOW)).toEqual({ earned: 25, available: 5, draws: 0, untilNext: 5 });
  });

  it('completes season 1 in exactly as many draws as cards, then marks duplicates', async () => {
    const { service } = await setup((SEASON_1.length + 1) * 10);
    const outcomes = [];
    for (let i = 0; i < SEASON_1.length; i += 1) outcomes.push(await service.draw(NOW));

    expect(outcomes.every((o) => o !== null && !o.duplicate)).toBe(true);
    expect(new Set(outcomes.map((o) => o?.card.id)).size).toBe(SEASON_1.length);

    const extra = await service.draw(NOW);
    expect(extra?.duplicate).toBe(true);

    const collection = await service.collection();
    expect(collection.every((entry) => entry.count >= 1)).toBe(true);
    expect(collection.reduce((sum, entry) => sum + entry.count, 0)).toBe(SEASON_1.length + 1);
    expect(collection.find((e) => e.card.id === extra?.card.id)?.count).toBe(2);
  });

  it('returns the draw id so the reveal screen can reload it', async () => {
    const { service, draws } = await setup(10);
    const outcome = await service.draw(NOW);
    const [row] = await draws.findAll();
    expect(outcome?.drawId).toBe(row?.id);
    expect(row?.card_id).toBe(outcome?.card.id);
  });

  it('ignores draw rows whose card left the catalog', async () => {
    const { service, draws } = await setup(0);
    await draws.insertWithin(() => ({ card_id: 'cat-999', drawn_at: NOW, duplicate: false }));
    const collection = await service.collection();
    expect(collection).toHaveLength(SEASON_1.length);
    expect(collection.every((entry) => entry.count === 0)).toBe(true);
  });

  it('writes today as the epoch when the migration did not, and keeps it', async () => {
    const { service, meta } = await setup(30, null);
    // 과거 학습일은 소급하지 않는다.
    expect((await service.stampState(NOW)).earned).toBe(0);
    expect(await meta.get(CAT_CARD_EPOCH_KEY)).toBe('2027-06-01');

    await service.stampState(new Date(2027, 6, 1).getTime());
    expect(await meta.get(CAT_CARD_EPOCH_KEY)).toBe('2027-06-01');
  });
});
