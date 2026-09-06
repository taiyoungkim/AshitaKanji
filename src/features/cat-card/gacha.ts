// 뽑기 순수 함수. UI·DB 없이 테스트한다.
// Plan Ref: §7.2 AD-03 — 등급 확률 + tier 완주 시 재분배 + 등급 내 미보유 우선.
// 카탈로그와 가중치를 인자로 받는다. 종 수·등급 수를 하드코딩하지 않는다.
//
// 중요한 성질: 미보유 우선과 tier 재분배를 함께 쓰면 완주 전에는 중복이 나오지 않는다.
// 따라서 완주는 카드 수와 정확히 같은 횟수(시즌1 = 10뽑기 = 100일)에 이뤄지고,
// 등급 확률은 완주 시점이 아니라 "무엇이 언제 나오는가"(획득 순서)만 정한다.
// 완주를 늦추고 싶다면 미보유 우선을 확률적으로 약화시켜야 한다.

import type { CatCard, Rarity } from './catalog';

export interface DrawResult {
  card: CatCard;
  rarity: Rarity;
  /** 이미 보유한 카드를 다시 뽑았는지. */
  duplicate: boolean;
}

/**
 * 미보유 카드가 남은 등급만 후보로 두고 가중치를 정규화한다.
 * 전부 보유했다면 원래 가중치 전체를 그대로 쓴다(중복 뽑기).
 */
function candidateWeights(
  catalog: readonly CatCard[],
  weights: Readonly<Record<Rarity, number>>,
  owned: ReadonlySet<string>,
): [Rarity, number][] {
  const rarities = [...new Set(catalog.map((c) => c.rarity))];
  const unfinished = rarities.filter((r) =>
    catalog.some((c) => c.rarity === r && !owned.has(c.id)),
  );
  const pool = unfinished.length > 0 ? unfinished : rarities;
  return pool.map((r) => [r, weights[r] ?? 0]);
}

function pickAt<T>(items: readonly T[], roll: number): T {
  const item = items[Math.min(Math.floor(roll * items.length), items.length - 1)];
  if (item === undefined) throw new Error('empty pool');
  return item;
}

function pickWeighted(entries: [Rarity, number][], roll: number): Rarity {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  // 가중치 합이 0이면 균등 분배로 떨어뜨린다.
  if (total <= 0) return pickAt(entries, roll)[0];
  let cursor = roll * total;
  for (const [rarity, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return rarity;
  }
  return pickAt(entries, 1)[0];
}

/**
 * 카드 1장을 뽑는다.
 * @param random 0 이상 1 미만. 테스트에서 고정값을 주입한다.
 */
export function draw(
  catalog: readonly CatCard[],
  weights: Readonly<Record<Rarity, number>>,
  owned: ReadonlySet<string>,
  random: () => number = Math.random,
): DrawResult {
  if (catalog.length === 0) throw new Error('catalog is empty');

  const rarity = pickWeighted(candidateWeights(catalog, weights, owned), random());
  const tier = catalog.filter((c) => c.rarity === rarity);
  const unowned = tier.filter((c) => !owned.has(c.id));
  // 등급 내 미보유 우선. 다 모았으면 그 등급에서 중복을 뽑는다.
  const pool = unowned.length > 0 ? unowned : tier;
  const card = pickAt(pool, random());

  return { card, rarity, duplicate: owned.has(card.id) };
}

/** 도장 n개당 1뽑기. 남은 도장은 이월된다. Plan Ref: FR-02 */
export const STAMPS_PER_DRAW = 10;

export function availableDraws(stamps: number): number {
  return Math.floor(Math.max(stamps, 0) / STAMPS_PER_DRAW);
}

export function spendStamps(stamps: number, draws = 1): number {
  return Math.max(stamps - draws * STAMPS_PER_DRAW, 0);
}
