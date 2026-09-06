import { describe, expect, it } from 'vitest';
import { availableDraws, draw, spendStamps, STAMPS_PER_DRAW } from './gacha';
import { RARITY_WEIGHTS, SEASON_1, type CatCard } from './catalog';

describe('draw', () => {
  it('등급 내 미보유 카드를 먼저 준다', () => {
    const owned = new Set(['cat-001']);
    // roll 0 → 첫 등급(N), 두 번째 roll 0 → 미보유 풀의 첫 카드
    const result = draw(SEASON_1, RARITY_WEIGHTS, owned, () => 0);
    expect(result.card.id).toBe('cat-002');
    expect(result.duplicate).toBe(false);
  });

  it('완주한 등급은 후보에서 빠지고 남은 등급으로 재분배된다', () => {
    const owned = new Set(SEASON_1.filter((c) => c.rarity === 'N').map((c) => c.id));
    // N 이 완주됐으므로 roll 0 이어도 N 이 나오면 안 된다
    const result = draw(SEASON_1, RARITY_WEIGHTS, owned, () => 0);
    expect(result.rarity).not.toBe('N');
  });

  it('전부 보유하면 중복을 준다', () => {
    const owned = new Set(SEASON_1.map((c) => c.id));
    const result = draw(SEASON_1, RARITY_WEIGHTS, owned, () => 0);
    expect(result.duplicate).toBe(true);
  });

  it('완주 전에는 중복이 나오지 않아 카드 수만큼에 정확히 완주한다', () => {
    for (let t = 0; t < 2000; t += 1) {
      const owned = new Set<string>();
      let pulls = 0;
      while (owned.size < SEASON_1.length) {
        const result = draw(SEASON_1, RARITY_WEIGHTS, owned);
        expect(result.duplicate).toBe(false);
        owned.add(result.card.id);
        pulls += 1;
        if (pulls > 500) throw new Error('완주 불가 — 재분배가 동작하지 않는다');
      }
      expect(pulls).toBe(SEASON_1.length);
    }
  });

  it('등급 확률은 완주 시점이 아니라 획득 순서를 정한다', () => {
    // SR 이 첫 장으로 나오는 비율이 초기 가중치(5%) 근처여야 한다.
    let srFirst = 0;
    const trials = 4000;
    for (let t = 0; t < trials; t += 1) {
      if (draw(SEASON_1, RARITY_WEIGHTS, new Set()).rarity === 'SR') srFirst += 1;
    }
    expect(srFirst / trials).toBeGreaterThan(0.02);
    expect(srFirst / trials).toBeLessThan(0.09);
  });

  it('카탈로그를 늘려도 코드 변경 없이 동작한다', () => {
    const first = SEASON_1[0];
    if (!first) throw new Error('catalog is empty');
    const extended: CatCard[] = [...SEASON_1, { ...first, id: 'cat-011', season: 2, rarity: 'SR' }];
    const owned = new Set(extended.map((c) => c.id));
    owned.delete('cat-011');
    const result = draw(extended, RARITY_WEIGHTS, owned, () => 0.99);
    expect(result.card.id).toBe('cat-011');
  });
});

describe('도장 소모', () => {
  it('10개마다 1뽑기, 나머지는 이월된다', () => {
    expect(availableDraws(9)).toBe(0);
    expect(availableDraws(10)).toBe(1);
    expect(availableDraws(23)).toBe(2);
    expect(spendStamps(23)).toBe(13);
    expect(spendStamps(23, 2)).toBe(3);
    expect(spendStamps(5)).toBe(0);
    expect(STAMPS_PER_DRAW).toBe(10);
  });
});
