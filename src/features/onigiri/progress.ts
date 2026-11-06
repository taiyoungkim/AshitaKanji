import type { SessionRepo } from '~/db/repos/SessionRepo';
import type { SessionRecord } from '~/types/Session';
import {
  INGREDIENTS_PER_ONIGIRI,
  TEMP_ONIGIRI_CATALOG,
} from './catalog';
import type { OnigiriCatalogItem } from './types';

export type OnigiriProgressStatus = 'locked' | 'inProgress' | 'completed';

export interface OnigiriProgressEntry {
  item: OnigiriCatalogItem;
  status: OnigiriProgressStatus;
  ingredientCount: number;
  acquiredIngredients: readonly string[];
  nextIngredient: string | null;
  completedAt: number | null;
}

export interface OnigiriIngredientReward {
  sessionId: number | null;
  item: OnigiriCatalogItem;
  ingredientIndex: number;
  ingredient: string;
  crafted: boolean;
  earnedAt: number;
}

export interface OnigiriProgressSnapshot {
  entries: readonly OnigiriProgressEntry[];
  current: OnigiriProgressEntry;
  completedCount: number;
  totalCount: number;
  totalIngredientsEarned: number;
  overflowCompletedSessions: number;
  lastReward: OnigiriIngredientReward | null;
}

interface IngredientSession {
  id: number | null;
  earnedAt: number;
}

function sessionTimestamp(session: SessionRecord): number {
  return session.ended_at ?? session.started_at;
}

function isIngredientSession(session: SessionRecord): boolean {
  return (
    session.ended_reason === 'completed' &&
    session.done_new + session.done_review > 0
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildIngredientSessions(sessions: readonly SessionRecord[]): IngredientSession[] {
  return sessions
    .filter(isIngredientSession)
    .map((session) => ({
      id: session.id ?? null,
      earnedAt: sessionTimestamp(session),
    }))
    .sort((a, b) => a.earnedAt - b.earnedAt);
}

export function computeOnigiriProgress(
  sessions: readonly SessionRecord[],
  catalog: readonly OnigiriCatalogItem[] = TEMP_ONIGIRI_CATALOG,
): OnigiriProgressSnapshot {
  if (catalog.length === 0) {
    throw new Error('Onigiri catalog must contain at least one item');
  }

  const ingredientSessions = buildIngredientSessions(sessions);
  const maxIngredients = catalog.length * INGREDIENTS_PER_ONIGIRI;
  const totalIngredientsEarned = clamp(ingredientSessions.length, 0, maxIngredients);
  const overflowCompletedSessions = Math.max(0, ingredientSessions.length - maxIngredients);
  const activeOrder = clamp(
    Math.floor(totalIngredientsEarned / INGREDIENTS_PER_ONIGIRI) + 1,
    1,
    catalog.length,
  );

  const entries: OnigiriProgressEntry[] = catalog.map((item) => {
    const itemStart = (item.order - 1) * INGREDIENTS_PER_ONIGIRI;
    const ingredientCount = clamp(
      totalIngredientsEarned - itemStart,
      0,
      INGREDIENTS_PER_ONIGIRI,
    );
    const completedAt =
      ingredientCount === INGREDIENTS_PER_ONIGIRI
        ? ingredientSessions[itemStart + INGREDIENTS_PER_ONIGIRI - 1]?.earnedAt ?? null
        : null;
    const status =
      ingredientCount === INGREDIENTS_PER_ONIGIRI
        ? 'completed'
        : item.order === activeOrder
          ? 'inProgress'
          : 'locked';

    return {
      item,
      status,
      ingredientCount,
      acquiredIngredients: item.ingredients.slice(0, ingredientCount),
      nextIngredient: item.ingredients[ingredientCount] ?? null,
      completedAt,
    };
  });

  const current =
    entries.find((entry) => entry.status === 'inProgress') ??
    entries[entries.length - 1];
  if (!current) {
    throw new Error('Onigiri progress requires at least one entry');
  }

  const lastReward = buildLastReward(
    ingredientSessions,
    totalIngredientsEarned,
    overflowCompletedSessions,
    catalog,
  );

  return {
    entries,
    current,
    completedCount: entries.filter((entry) => entry.status === 'completed').length,
    totalCount: catalog.length,
    totalIngredientsEarned,
    overflowCompletedSessions,
    lastReward,
  };
}

function buildLastReward(
  ingredientSessions: readonly IngredientSession[],
  totalIngredientsEarned: number,
  overflowCompletedSessions: number,
  catalog: readonly OnigiriCatalogItem[],
): OnigiriIngredientReward | null {
  if (totalIngredientsEarned === 0 || overflowCompletedSessions > 0) return null;

  const rewardIndex = totalIngredientsEarned - 1;
  const itemIndex = Math.floor(rewardIndex / INGREDIENTS_PER_ONIGIRI);
  const ingredientIndex = rewardIndex % INGREDIENTS_PER_ONIGIRI;
  const item = catalog[itemIndex];
  const ingredientSession = ingredientSessions[rewardIndex];
  const ingredient = item?.ingredients[ingredientIndex];
  if (!item || !ingredientSession || !ingredient) return null;

  return {
    sessionId: ingredientSession.id,
    item,
    ingredientIndex,
    ingredient,
    crafted: ingredientIndex === INGREDIENTS_PER_ONIGIRI - 1,
    earnedAt: ingredientSession.earnedAt,
  };
}

/**
 * 특정 세션이 받은 재료. 홈 '오늘 학습 완료' 카드가 오늘 획득한 재료를 보여줄 때 쓴다.
 * 지급 규칙은 computeOnigiriProgress 와 같다(completed + 학습 1개 이상 세션 = 재료 1개).
 * 카탈로그를 넘친 세션이나 재료를 받지 않은 세션은 null.
 */
export function findIngredientRewardForSession(
  sessions: readonly SessionRecord[],
  sessionId: number | null,
  catalog: readonly OnigiriCatalogItem[] = TEMP_ONIGIRI_CATALOG,
): OnigiriIngredientReward | null {
  if (sessionId === null) return null;
  const ingredientSessions = buildIngredientSessions(sessions);
  const rewardIndex = ingredientSessions.findIndex((session) => session.id === sessionId);
  if (rewardIndex < 0 || rewardIndex >= catalog.length * INGREDIENTS_PER_ONIGIRI) return null;
  const item = catalog[Math.floor(rewardIndex / INGREDIENTS_PER_ONIGIRI)];
  const ingredientIndex = rewardIndex % INGREDIENTS_PER_ONIGIRI;
  const ingredient = item?.ingredients[ingredientIndex];
  const session = ingredientSessions[rewardIndex];
  if (!item || !ingredient || !session) return null;
  return {
    sessionId,
    item,
    ingredientIndex,
    ingredient,
    crafted: ingredientIndex === INGREDIENTS_PER_ONIGIRI - 1,
    earnedAt: session.earnedAt,
  };
}

export class OnigiriProgressService {
  constructor(
    private readonly sessionRepo: SessionRepo,
    private readonly catalog: readonly OnigiriCatalogItem[] = TEMP_ONIGIRI_CATALOG,
  ) {}

  async getSnapshot(): Promise<OnigiriProgressSnapshot> {
    const sessions = await this.sessionRepo.findAll();
    return computeOnigiriProgress(sessions, this.catalog);
  }
}
